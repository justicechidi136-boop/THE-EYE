"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";
import type { FieldDeviceView } from "../../lib/types/admin-views";

type FieldDeviceActionsProps = {
  device: FieldDeviceView;
  canManage: boolean;
};

type ActionDef = {
  action: string;
  label: string;
  variant?: "danger";
  confirm?: string;
};

const ACTIONS: ActionDef[] = [
  { action: "approve", label: "Approve device" },
  { action: "reject", label: "Reject", variant: "danger", confirm: "Reject this field tablet registration?" },
  { action: "suspend", label: "Suspend", confirm: "Suspend this field tablet?" },
  { action: "restore", label: "Restore" },
  { action: "mark-lost", label: "Mark lost", variant: "danger", confirm: "Mark this field tablet as lost?" },
  { action: "revoke", label: "Revoke", variant: "danger", confirm: "Revoke this field tablet? It will lose operational access." },
  { action: "require-re-pair", label: "Require re-pair", confirm: "Require secure re-pairing on next use?" },
  { action: "force-sign-out", label: "Force sign-out", confirm: "Force sign-out all active sessions on this device?" },
];

export function FieldDeviceActions({ device, canManage }: FieldDeviceActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!canManage) {
    return <InlineAlert tone="warning">You do not have permission to manage field tablets.</InlineAlert>;
  }

  async function runAction(action: string, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/field-devices/${encodeURIComponent(device.id)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined, reason: note || undefined }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      setMessage(`${action.replace(/-/g, " ")} completed.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Reason / note (required for destructive actions)</span>
        <textarea
          className="min-h-[72px] rounded-md border border-line bg-surface px-3 py-2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Supervisor note for audit trail"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(({ action, label, variant, confirm }) => (
          <Button key={action} disabled={busy !== null} variant={variant} onClick={() => runAction(action, confirm)}>
            {label}
          </Button>
        ))}
      </div>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
