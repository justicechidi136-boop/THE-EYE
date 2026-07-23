"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  deviceId: string;
  deviceLabel: string;
};

const destructiveActions = new Set(["revoke", "mark-lost", "mark-stolen", "remote-wipe"]);

export function SmartwatchDeviceActions({ deviceId, deviceLabel }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function runAction(action: string) {
    if (destructiveActions.has(action) && reason.trim().length < 4) {
      setError("A reason of at least 4 characters is required.");
      return;
    }
    if (!window.confirm(`Confirm ${action.replace(/-/g, " ")} for ${deviceLabel}?`)) return;

    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/smartwatch/devices/${deviceId}/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Action failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-3">
      <label className="text-sm">
        <span className="font-semibold">Reason (required for revoke / lost / stolen)</span>
        <textarea
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Operational reason for audit trail"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending != null}
        className="rounded-md border border-line px-4 py-3 text-sm font-semibold disabled:opacity-50"
        onClick={() => runAction("deactivate-push")}
      >
        {pending === "deactivate-push" ? "Working…" : "Deactivate push tokens"}
      </button>
      <button
        type="button"
        disabled={pending != null}
        className="rounded-md border border-line px-4 py-3 text-sm font-semibold disabled:opacity-50"
        onClick={() => runAction("require-re-pair")}
      >
        {pending === "require-re-pair" ? "Working…" : "Require re-pair"}
      </button>
      <button
        type="button"
        disabled={pending != null}
        className="rounded-md border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 disabled:opacity-50"
        onClick={() => runAction("mark-lost")}
      >
        {pending === "mark-lost" ? "Working…" : "Mark lost"}
      </button>
      <button
        type="button"
        disabled={pending != null}
        className="rounded-md border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 disabled:opacity-50"
        onClick={() => runAction("mark-stolen")}
      >
        {pending === "mark-stolen" ? "Working…" : "Mark stolen"}
      </button>
      <button
        type="button"
        disabled={pending != null}
        className="rounded-md border border-line px-4 py-3 text-sm font-semibold disabled:opacity-50"
        onClick={() => runAction("clear-security")}
      >
        {pending === "clear-security" ? "Working…" : "Clear lost/stolen status"}
      </button>
      <button
        type="button"
        disabled={pending != null}
        className="rounded-md border border-line px-4 py-3 text-sm font-semibold disabled:opacity-50"
        onClick={() => runAction("unpair")}
      >
        {pending === "unpair" ? "Working…" : "Unpair device"}
      </button>
      <button
        type="button"
        disabled={pending != null}
        className="rounded-md border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50"
        onClick={() => runAction("revoke")}
      >
        {pending === "revoke" ? "Working…" : "Revoke device"}
      </button>
    </div>
  );
}
