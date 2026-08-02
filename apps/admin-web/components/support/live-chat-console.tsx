"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LiveChatConsoleProps = {
  conversationId: string;
  canAssign: boolean;
  canEscalate: boolean;
};

export function LiveChatConsole({ conversationId, canAssign, canEscalate }: LiveChatConsoleProps) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? `Request failed (${response.status})`);
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Reply to citizen</span>
        <textarea
          className="min-h-24 rounded-md border border-line bg-surface px-3 py-2 text-sm"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Type a support reply"
        />
        <button
          type="button"
          disabled={busy || !reply.trim()}
          className="rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => post(`/api/admin/support-chats/${conversationId}/reply`, { body: reply.trim() })}
        >
          Send reply
        </button>
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Internal note (hidden from citizen)</span>
        <textarea
          className="min-h-20 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm"
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          placeholder="Dispatcher-only note"
        />
        <button
          type="button"
          disabled={busy || !internalNote.trim()}
          className="rounded-md border border-warning px-4 py-2 text-sm font-semibold text-warning disabled:opacity-50"
          onClick={() =>
            post(`/api/admin/support-chats/${conversationId}/internal-note`, { body: internalNote.trim() })
          }
        >
          Add internal note
        </button>
      </label>
      <div className="flex flex-wrap gap-2">
        {canAssign ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
            onClick={() => post(`/api/admin/support-chats/${conversationId}/assign`, {})}
          >
            Assign to me
          </button>
        ) : null}
        {canEscalate ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
            onClick={() => post(`/api/admin/support-chats/${conversationId}/escalate`, { reason: "Manual escalation" })}
          >
            Escalate to Command Centre
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
          onClick={() => post(`/api/admin/support-chats/${conversationId}/resolve`, { status: "Resolved" })}
        >
          Resolve
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
          onClick={() => post(`/api/admin/support-chats/${conversationId}/close`, { status: "Closed" })}
        >
          Close
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
          onClick={() => post(`/api/admin/support-chats/${conversationId}/reopen`, {})}
        >
          Reopen
        </button>
      </div>
    </div>
  );
}
