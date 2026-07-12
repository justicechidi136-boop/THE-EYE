"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../form-primitives";

type Props = {
  postId: string;
  status: "Verified" | "False" | "Disputed";
};

export function PostVerifyButton({ postId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/csoc/posts/${postId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, moderatorConfirmed: true }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Verification failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <Button type="button" variant={status === "False" ? "danger" : "secondary"} disabled={loading} onClick={handleClick}>
        {loading ? "..." : status}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
