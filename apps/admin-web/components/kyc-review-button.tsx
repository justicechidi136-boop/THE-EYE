"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./form-primitives";

type Props = {
  kycId: string;
  decision: "approve" | "reject";
};

export function KycReviewButton({ kycId, decision }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function handleClick() {
    if (decision === "reject" && reason.trim().length < 3) {
      setError("Enter a rejection reason");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/kyc/${kycId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() || undefined }),
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
      {decision === "reject" ? (
        <input
          className="rounded border border-line bg-surface px-2 py-1 text-sm"
          placeholder="Rejection reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}
      <Button
        type="button"
        variant={decision === "approve" ? "primary" : "danger"}
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? "..." : decision === "approve" ? "Approve KYC" : "Reject KYC"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
