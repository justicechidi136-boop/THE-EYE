"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "./form-primitives";

type BroadcastActionsProps = {
  broadcastId: string;
  status: string;
  requiresApproval: boolean;
};

export function BroadcastActions({ broadcastId, status, requiresApproval }: BroadcastActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function runAction(action: string, body?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/broadcasts/${broadcastId}/${action}`, {
        method: action === "dispatch" || action === "retry" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json()) as { message?: string; ok?: boolean };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      setMessage(`${action} completed for ${broadcastId}.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {(status === "Pending approval" || status === "Draft") && requiresApproval ? (
          <>
            <Button disabled={busy !== null} onClick={() => runAction("approve", { note: "Approved from admin dashboard" })}>
              Approve
            </Button>
            <Button disabled={busy !== null} variant="danger" onClick={() => runAction("reject", { reason: "Rejected from admin dashboard" })}>
              Reject
            </Button>
          </>
        ) : null}
        {status === "Published" ? (
          <>
            <Button disabled={busy !== null} onClick={() => runAction("dispatch")}>Dispatch</Button>
            <Button disabled={busy !== null} onClick={() => runAction("retry")}>Retry failed</Button>
            <Button disabled={busy !== null} variant="danger" onClick={() => runAction("cancel", { reason: "Cancelled from admin dashboard" })}>
              Cancel
            </Button>
          </>
        ) : null}
        {status === "Draft" || status === "Pending approval" ? (
          <Button
            disabled={busy !== null}
            onClick={() =>
              runAction("schedule", {
                scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              })
            }
          >
            Schedule +1h
          </Button>
        ) : null}
        <Button disabled={busy !== null} onClick={() => runAction("preview")}>Preview</Button>
        <Button disabled={busy !== null} onClick={() => runAction("estimate")}>Estimate</Button>
        <Button disabled={busy !== null} onClick={() => runAction("progress")}>Progress</Button>
      </div>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
