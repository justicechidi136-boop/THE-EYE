"use client";

import { useState } from "react";
import { Button } from "./form-primitives";

type Props = {
  incidentId: string;
  mediaId: string;
  label: string;
};

export function EvidenceViewButton({ incidentId, mediaId, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleView() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}/media/${mediaId}/view`);
      const payload = (await response.json()) as { signedUrl?: string; message?: string };
      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.message ?? "Evidence view unavailable");
      }
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evidence view failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <Button type="button" variant="secondary" disabled={loading || !mediaId} onClick={handleView}>
        {loading ? "..." : label}
      </Button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
