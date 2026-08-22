"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

type SmartwatchDeviceActionsProps = {
  deviceId: string;
  isActive: boolean;
  activationStatus: string;
  restrictionReason?: string | null;
  canManage: boolean;
};

export function SmartwatchDeviceActions({ deviceId, isActive, activationStatus, restrictionReason, canManage }: SmartwatchDeviceActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return <InlineAlert tone="warning">You do not have permission to manage smartwatches.</InlineAlert>;
  }

  async function runAction(action: "activate" | "deactivate") {
    const confirmation = {
      activate: "Reactivate this watch? The action will be recorded in the audit log.",
      deactivate: "Deactivate this watch and stop its authenticated device traffic?",
    }[action];
    if (!window.confirm(confirmation)) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/smartwatch/devices/${encodeURIComponent(deviceId)}/${action}`, { method: "PATCH" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      setMessage(`${action.replace("-", " ")} completed.`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      {activationStatus.toUpperCase() === "LOCKED" ? (
        <InlineAlert tone="warning">
          Activation is locked{restrictionReason ? `: ${restrictionReason}` : ""}. Use the authorized recovery workflow to issue one new code.
        </InlineAlert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {activationStatus.toUpperCase() === "LOCKED" ? (
          <Link className="rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white" href="/devices/smart-watches/pending-activations">
            Open recovery
          </Link>
        ) : isActive ? (
          <Button disabled={busy !== null} variant="danger" onClick={() => runAction("deactivate")}>
            Disable watch
          </Button>
        ) : (
          <Button disabled={busy !== null} onClick={() => runAction("activate")}>
            Activate watch
          </Button>
        )}
      </div>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
