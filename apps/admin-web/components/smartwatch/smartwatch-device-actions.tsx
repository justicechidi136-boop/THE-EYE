"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

type SmartwatchDeviceActionsProps = {
  deviceId: string;
  isActive: boolean;
  canManage: boolean;
};

export function SmartwatchDeviceActions({ deviceId, isActive, canManage }: SmartwatchDeviceActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return <InlineAlert tone="warning">You do not have permission to manage smartwatches.</InlineAlert>;
  }

  async function runAction(action: "activate" | "deactivate" | "remote-wipe") {
    if (action === "remote-wipe" && !window.confirm("Queue remote wipe for this watch? This cannot be undone.")) return;
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
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Button disabled={busy !== null} variant="danger" onClick={() => runAction("deactivate")}>
            Disable watch
          </Button>
        ) : (
          <Button disabled={busy !== null} onClick={() => runAction("activate")}>
            Activate watch
          </Button>
        )}
        <Button disabled={busy !== null} variant="danger" onClick={() => runAction("remote-wipe")}>
          Remote wipe
        </Button>
      </div>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
