"use client";

import { useState } from "react";
import { Button } from "./form-primitives";

type ModerationStatus = "Approved" | "Flagged" | "Rejected";

type Props = {
  endpoint: string;
  currentStatus?: string | null;
};

export function VoiceModerationActions({ endpoint, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus ?? "Pending");
  const [loading, setLoading] = useState<ModerationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(next: ModerationStatus) {
    setLoading(next);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderationStatus: next }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Moderation update failed");
      }
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Moderation update failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs uppercase text-muted">Moderation: {status}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["Approved", "Flagged", "Rejected"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant={status === option ? "primary" : "secondary"}
            disabled={loading != null}
            onClick={() => updateStatus(option)}
          >
            {loading === option ? "Saving..." : option}
          </Button>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
