"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./form-primitives";

type Props = {
  incidentId: string;
  decision: "confirm" | "reject" | "needs_more_evidence";
  label: string;
  variant?: "primary" | "secondary" | "danger";
};

export function IncidentReviewButton({ incidentId, decision, label, variant = "primary" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function handleClick() {
    if ((decision === "reject" || decision === "needs_more_evidence") && note.trim().length < 3) {
      setError("Enter a review note");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/verification/incidents/${incidentId}/admin-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Review failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-2">
      {decision !== "confirm" ? (
        <input
          className="rounded border border-line bg-surface px-2 py-1 text-sm"
          placeholder="Review note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      ) : null}
      <Button type="button" variant={variant} disabled={loading} onClick={handleClick}>
        {loading ? "..." : label}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
