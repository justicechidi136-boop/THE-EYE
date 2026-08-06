"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

type BroadcastModerationActionsProps = {
  broadcastId: string;
  status: string;
  adminVerified: boolean;
  authorLabel: "Citizen" | "Admin" | "Verified";
  showCommentForm?: boolean;
};

export function BroadcastModerationActions({
  broadcastId,
  status,
  adminVerified,
  authorLabel,
  showCommentForm = false,
}: BroadcastModerationActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [pinComment, setPinComment] = useState(false);

  async function runAction(action: string, body?: Record<string, unknown>, method: "POST" | "DELETE" = "POST") {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/broadcasts/${broadcastId}/${action}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json()) as { message?: string; ok?: boolean };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      setMessage(`${action} completed.`);
      if (action === "comment") {
        setCommentBody("");
        setPinComment(false);
      }
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  const isSuspended = status === "Suspended";
  const isTerminal = status === "Resolved" || status === "DeletedByAdmin" || status === "WithdrawnByAuthor";

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {!isSuspended && !isTerminal ? (
          <Button disabled={busy !== null} variant="danger" onClick={() => runAction("suspend", { reason: "Suspended from admin workspace" })}>
            Suspend
          </Button>
        ) : null}
        {isSuspended ? (
          <Button disabled={busy !== null} onClick={() => runAction("restore")}>
            Restore
          </Button>
        ) : null}
        {!adminVerified && authorLabel !== "Admin" ? (
          <Button disabled={busy !== null} onClick={() => runAction("verify", { note: "Verified from admin workspace" })}>
            Verify
          </Button>
        ) : null}
        {!isTerminal && status !== "Resolved" ? (
          <Button disabled={busy !== null} onClick={() => runAction("resolve", { note: "Resolved from admin workspace" })}>
            Resolve
          </Button>
        ) : null}
        {!isTerminal ? (
          <Button disabled={busy !== null} variant="danger" onClick={() => runAction("delete", { reason: "Removed from admin workspace" }, "DELETE")}>
            Delete
          </Button>
        ) : null}
      </div>

      {showCommentForm ? (
        <div className="grid gap-2 rounded-lg border border-line bg-surfaceMuted p-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted">Official comment</span>
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              rows={3}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
              placeholder="Add an official moderation comment visible to citizens"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={pinComment} onChange={(event) => setPinComment(event.target.checked)} />
            Pin comment
          </label>
          <Button
            disabled={busy !== null || !commentBody.trim()}
            onClick={() => runAction("comment", { body: commentBody.trim(), pin: pinComment })}
          >
            Post official comment
          </Button>
        </div>
      ) : (
        <Button disabled={busy !== null} variant="secondary" onClick={() => runAction("comment", { body: "Official update posted from admin workspace." })}>
          Quick official comment
        </Button>
      )}

      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}

export function authorLabelTone(label: "Citizen" | "Admin" | "Verified"): "info" | "success" | "warning" | "neutral" {
  if (label === "Admin") return "info";
  if (label === "Verified") return "success";
  return "warning";
}
