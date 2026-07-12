"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../form-primitives";

type Props = {
  communityId: string;
  membershipId: string;
  action: "approve" | "reject";
};

export function MembershipActionButton({ communityId, membershipId, action }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/csoc/memberships/${membershipId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId, action }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Action failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={action === "approve" ? "primary" : "danger"}
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? "..." : action === "approve" ? "Approve" : "Reject"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
