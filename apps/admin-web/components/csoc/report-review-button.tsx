"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../form-primitives";

export function ReportReviewButton({
  reportId,
  action,
}: Readonly<{ reportId: string; action: "reviewed" | "dismissed" }>) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/csoc/reports/${reportId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
    <div className="inline-flex flex-col gap-1">
      <Button type="button" variant={action === "reviewed" ? "primary" : "secondary"} disabled={loading} onClick={handleClick}>
        {loading ? "..." : action === "reviewed" ? "Mark reviewed" : "Dismiss"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
