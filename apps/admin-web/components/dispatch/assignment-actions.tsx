"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

type AssignmentActionsProps = {
  assignmentId: string;
  assignmentVersion: number;
  assignmentStatus: string;
};

export function AssignmentActions({ assignmentId, assignmentVersion, assignmentStatus }: AssignmentActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [backupReason, setBackupReason] = useState("");

  async function runAssignmentAction(action: string, body?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dispatch/assignments/${assignmentId}/${action}`, {
        method: action === "cancel" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      setMessage(`${action} completed.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted">Assignment {assignmentId.slice(0, 8)}… · v{assignmentVersion} · {assignmentStatus}</p>
      <label className="grid gap-1 text-sm">
        Internal note
        <textarea
          className="min-h-20 rounded-md border border-line px-3 py-2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Dispatcher note visible in assignment audit"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Backup request reason
        <textarea
          className="min-h-16 rounded-md border border-line px-3 py-2"
          value={backupReason}
          onChange={(event) => setBackupReason(event.target.value)}
          placeholder="Required for backup requests"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy !== null || note.trim().length < 5}
          onClick={() => runAssignmentAction("note", { note: note.trim(), clientActionId: crypto.randomUUID() })}
        >
          Add note
        </Button>
        <Button
          disabled={busy !== null || backupReason.trim().length < 5}
          onClick={() => runAssignmentAction("request-backup", { reason: backupReason.trim() })}
        >
          Request backup
        </Button>
        <Button
          disabled={busy !== null || assignmentStatus === "Cancelled"}
          variant="danger"
          onClick={() =>
            runAssignmentAction("cancel", {
              version: assignmentVersion,
              action: "cancel",
              note: note.trim() || "Cancelled from command center",
              clientActionId: crypto.randomUUID(),
            })
          }
        >
          Cancel assignment
        </Button>
      </div>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
