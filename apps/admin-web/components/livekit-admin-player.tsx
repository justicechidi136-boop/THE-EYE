"use client";

import { useEffect, useRef, useState } from "react";

export type LivekitPlayerState = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";

type Props = {
  sessionId: string;
  sessionStatus: string;
  onStateChange?: (state: LivekitPlayerState) => void;
};

export function LivekitAdminPlayer({ sessionId, sessionStatus, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerState, setPlayerState] = useState<LivekitPlayerState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStateChange?.(playerState);
  }, [onStateChange, playerState]);

  useEffect(() => {
    if (sessionStatus !== "Active" || !sessionId || sessionId === "-") {
      setPlayerState("idle");
      setError(null);
      return;
    }

    let room: import("livekit-client").Room | null = null;
    let cancelled = false;

    async function connect() {
      setPlayerState("connecting");
      setError(null);
      try {
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
        room = new Room({ adaptiveStream: true, dynacast: true });
        room.on(RoomEvent.Reconnecting, () => {
          if (!cancelled) setPlayerState("reconnecting");
        });
        room.on(RoomEvent.Reconnected, () => {
          if (!cancelled) setPlayerState("connected");
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setPlayerState("disconnected");
        });
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
          }
        });
        await room.connect(url, token, { autoSubscribe: true });
        if (!cancelled) setPlayerState("connected");
      } catch (connectError) {
        if (!cancelled) {
          setPlayerState("failed");
          setError(connectError instanceof Error ? connectError.message : "Connection failed");
        }
      }
    }

    void connect();
    return () => {
      cancelled = true;
      void room?.disconnect();
    };
  }, [sessionId, sessionStatus]);

  return (
    <div className="relative h-full min-h-[520px] w-full">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline autoPlay muted />
      {playerState !== "connected" ? (
        <div className="absolute inset-0 grid place-items-center bg-command/80 px-6 text-center text-white">
          <div>
            {playerState === "connecting" ? <p className="text-lg font-semibold">Connecting to authorized stream...</p> : null}
            {playerState === "reconnecting" ? <p className="text-lg font-semibold">Reconnecting...</p> : null}
            {playerState === "disconnected" ? <p className="text-lg font-semibold">Stream disconnected</p> : null}
            {playerState === "failed" ? <p className="text-lg font-semibold">{error ?? "Connection failed"}</p> : null}
            {playerState === "idle" ? <p className="text-lg font-semibold">Select an active incident stream</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
