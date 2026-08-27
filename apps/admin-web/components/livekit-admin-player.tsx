"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./form-primitives";

export type LivekitPlayerState = "idle" | "connecting" | "waiting" | "connected" | "paused" | "reconnecting" | "disconnected" | "failed" | "unavailable";

type Props = {
  sessionId: string;
  sessionStatus: string;
  onStateChange?: (state: LivekitPlayerState) => void;
};

export function LivekitAdminPlayer({ sessionId, sessionStatus, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const [playerState, setPlayerState] = useState<LivekitPlayerState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStateChange?.(playerState);
  }, [onStateChange, playerState]);

  useEffect(() => {
    setError(null);
    setPlayerState(sessionStatus === "Active" && sessionId && sessionId !== "-" ? "idle" : "unavailable");
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [sessionId, sessionStatus]);

  async function connect() {
    if (sessionStatus !== "Active" || !sessionId || sessionId === "-") {
      setPlayerState("unavailable");
      return;
    }

    setPlayerState("connecting");
    setError(null);
    try {
      await roomRef.current?.disconnect();
      roomRef.current = null;
      const response = await fetch(`/api/live-video/sessions/${sessionId}/admin-token`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to authorize live stream");
      }
      const payload = (await response.json()) as {
        livekit?: { url?: string; token?: string };
      };
      const url = payload.livekit?.url;
      const token = payload.livekit?.token;
      if (!url || !token) throw new Error("Live stream authorization token was not returned.");

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.Reconnecting, () => setPlayerState("reconnecting"));
      room.on(RoomEvent.Reconnected, () => setPlayerState(videoRef.current?.srcObject ? "connected" : "waiting"));
      room.on(RoomEvent.Disconnected, () => setPlayerState("disconnected"));
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          void videoRef.current.play().catch(() => undefined);
          setPlayerState("connected");
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          track.detach();
          setPlayerState("waiting");
        }
      });
      await room.connect(url, token, { autoSubscribe: true });
      let attached = false;
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.track && videoRef.current) {
            publication.track.attach(videoRef.current);
            void videoRef.current.play().catch(() => undefined);
            attached = true;
          }
        }
      }
      setPlayerState(attached ? "connected" : "waiting");
    } catch (connectError) {
      setPlayerState("failed");
      setError(connectError instanceof Error ? connectError.message : "Connection failed");
    }
  }

  function pause() {
    videoRef.current?.pause();
    setPlayerState("paused");
  }

  function resume() {
    void videoRef.current?.play();
    setPlayerState("connected");
  }

  return (
    <div className="relative h-full min-h-[520px] w-full">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted controls={playerState === "connected" || playerState === "paused"} />
      {playerState === "connected" ? (
        <div className="absolute bottom-4 right-4 z-20 flex flex-wrap gap-2">
          <Button type="button" variant="media" onClick={pause}>
            Pause
          </Button>
        </div>
      ) : null}
      {playerState !== "connected" && playerState !== "paused" ? (
        <div className="absolute inset-0 flex items-end justify-center bg-command/80 px-6 pb-8 text-center text-white">
          <div className="max-w-sm rounded-md bg-black/45 px-5 py-4">
            {playerState === "connecting" ? <p className="text-lg font-semibold">Connecting to authorized stream...</p> : null}
            {playerState === "waiting" ? <><p className="text-lg font-semibold">Connected, waiting for video...</p><p className="mt-2 text-sm text-white/80">The publisher has not sent an active video track yet.</p></> : null}
            {playerState === "reconnecting" ? <p className="text-lg font-semibold">Reconnecting...</p> : null}
            {playerState === "disconnected" ? <p className="text-lg font-semibold">Stream disconnected</p> : null}
            {playerState === "failed" ? <p className="text-lg font-semibold">{error ?? "Connection failed"}</p> : null}
            {playerState === "unavailable" ? <p className="text-lg font-semibold">No live stream is available for this incident.</p> : null}
            {playerState === "idle" ? (
              <>
                <p className="text-lg font-semibold">Live video is ready.</p>
                <p className="mt-2 text-sm text-white/80">Start playback when you are ready to monitor this incident.</p>
              </>
            ) : null}
            <div className="mt-4 flex justify-center">
              {playerState === "idle" || playerState === "failed" || playerState === "disconnected" ? (
                <Button type="button" variant="inverse" onClick={() => void connect()}>
                  {playerState === "failed" || playerState === "disconnected" ? "Retry live video" : "Play live video"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {playerState === "paused" ? (
        <div className="absolute inset-0 flex items-end justify-center bg-command/70 px-6 pb-8 text-center text-white">
          <div className="rounded-md bg-black/45 px-5 py-4">
            <p className="text-lg font-semibold">Live video paused.</p>
            <Button type="button" variant="inverse" className="mt-4" onClick={resume}>
              Play
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
