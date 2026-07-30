"use client";

import { useEffect, useRef, useState } from "react";
import { formatVoiceLanguageLabel } from "../lib/voice-language-labels";
import { Button } from "./form-primitives";
import { VoiceModerationActions } from "./voice-moderation-actions";

type VoiceEvidence = {
  id: string;
  durationSeconds?: number | null;
  transcriptionStatus?: string | null;
  transcript?: string | null;
  translatedTranscript?: string | null;
  selectedLanguage?: string | null;
  detectedLanguage?: string | null;
  transcriptionConfidence?: number | null;
  moderationStatus?: string | null;
  uploadedAt?: string | null;
};

type Props = {
  incidentId: string;
  media: VoiceEvidence;
};

export function AudioEvidencePlayer({ incidentId, media }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!audioRef.current || !signedUrl) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, signedUrl]);

  async function loadPlaybackUrl() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}/media/${media.id}/view`);
      const payload = (await response.json()) as { signedUrl?: string; message?: string };
      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.message ?? "Playback unavailable");
      }
      setSignedUrl(payload.signedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-semibold uppercase text-muted">Voice evidence</p>
      <p className="mt-1 text-sm text-muted">
        Duration: {media.durationSeconds ? `${media.durationSeconds}s` : "Unknown"}
        {media.uploadedAt ? ` · Uploaded ${new Date(media.uploadedAt).toLocaleString()}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={loading} onClick={loadPlaybackUrl}>
          {loading ? "Loading..." : signedUrl ? "Reload audio" : "Load audio"}
        </Button>
        {[0.75, 1, 1.25, 1.5].map((rate) => (
          <Button
            key={rate}
            type="button"
            variant={playbackRate === rate ? "primary" : "secondary"}
            onClick={() => setPlaybackRate(rate)}
          >
            {rate}x
          </Button>
        ))}
      </div>
      {signedUrl ? (
        <audio ref={audioRef} controls className="mt-3 w-full" src={signedUrl}>
          <track kind="captions" />
        </audio>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
        Automated transcript — verify against the original audio.
      </p>
      {media.transcript ? (
        <div className="mt-3">
          <p className="text-xs uppercase text-muted">Transcript</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{media.transcript}</p>
          <p className="mt-2 text-xs text-muted">
            Language: {formatVoiceLanguageLabel(media.selectedLanguage)} · Detected:{" "}
            {formatVoiceLanguageLabel(media.detectedLanguage)}
            {media.transcriptionConfidence != null
              ? ` · Confidence ${Math.round(Number(media.transcriptionConfidence) * 100)}%`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Transcription status: {media.transcriptionStatus ?? "Pending"}
        </p>
      )}
      {media.translatedTranscript ? (
        <div className="mt-3">
          <p className="text-xs uppercase text-muted">English translation</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{media.translatedTranscript}</p>
        </div>
      ) : null}
      <VoiceModerationActions
        endpoint={`/api/admin/incidents/${incidentId}/media/${media.id}/voice/moderation`}
        currentStatus={media.moderationStatus}
      />
    </div>
  );
}
