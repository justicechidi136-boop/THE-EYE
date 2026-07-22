"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../form-primitives";

type Props = {
  communityId: string;
  membershipId: string;
  status: string;
};

const actionsByStatus: Record<string, Array<{ action: "suspend" | "restore" | "ban" | "unban"; label: string }>> = {
  Approved: [
    { action: "suspend", label: "Suspend" },
    { action: "ban", label: "Ban" },
  ],
  Suspended: [
    { action: "restore", label: "Restore" },
    { action: "ban", label: "Ban" },
  ],
  Banned: [{ action: "unban", label: "Unban" }],
};

export function MembershipModerationButton({ communityId, membershipId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = actionsByStatus[status] ?? [];

  async function handleClick(action: "suspend" | "restore" | "ban" | "unban") {
    const note = window.prompt(`Moderator note for ${action}?`) ?? "";
    setLoading(action);
    setError(null);
    try {
      const response = await fetch(`/api/csoc/memberships/${membershipId}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId, action, note: note || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Moderation failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Moderation failed");
    } finally {
      setLoading(null);
    }
  }

  if (!actions.length) return <span className="text-xs text-muted">—</span>;

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {actions.map((item) => (
          <Button
            key={item.action}
            type="button"
            variant={item.action === "restore" || item.action === "unban" ? "secondary" : "danger"}
            disabled={loading !== null}
            onClick={() => handleClick(item.action)}
          >
            {loading === item.action ? "..." : item.label}
          </Button>
        ))}
      </div>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
