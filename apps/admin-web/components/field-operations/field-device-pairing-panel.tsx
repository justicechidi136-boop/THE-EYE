"use client";

import { useEffect, useState } from "react";
import { Button, InlineAlert, SelectInput } from "../form-primitives";
import type { FieldDeviceView, FieldPairingIssueView } from "../../lib/types/admin-views";
import { PairingQrCode } from "./pairing-qr-code";

type FieldDevicePairingPanelProps = {
  device: FieldDeviceView;
  canManage: boolean;
};

function formatCountdown(expiresAt: string): string {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remainingMs)) return "-";
  if (remainingMs <= 0) return "Expired";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function FieldDevicePairingPanel({ device, canManage }: FieldDevicePairingPanelProps) {
  const [pairing, setPairing] = useState<FieldPairingIssueView | null>(null);
  const [ttlMinutes, setTtlMinutes] = useState("15");
  const [busy, setBusy] = useState<"issue" | "regenerate" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!pairing) return;
    const interval = setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, [pairing]);

  const canIssue = Boolean(device.permissionProfileId);
  const isBound = device.isBound;

  async function callPairingApi(path: string, action: "issue" | "regenerate" | "cancel") {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/field-devices/${encodeURIComponent(device.id)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "cancel" ? { reason: "Cancelled by supervisor" } : { ttlMinutes: Number(ttlMinutes) }),
      });
      const payload = (await response.json()) as { data?: FieldPairingIssueView | { cancelled: number }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? `Failed to ${action} pairing`);
      if (action === "cancel") {
        setPairing(null);
        setMessage("Pairing cancelled. Any issued codes are now invalid.");
      } else {
        setPairing(payload.data as FieldPairingIssueView);
        setMessage(action === "issue" ? "Pairing code generated." : "Pairing code regenerated. The previous code no longer works.");
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} pairing`);
    } finally {
      setBusy(null);
    }
  }

  async function copyCode() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.shortCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  }

  if (!canManage) {
    return <InlineAlert tone="warning">You do not have permission to manage pairing for this device.</InlineAlert>;
  }

  if (device.provisioningMode !== "PreProvisioned") {
    return <p className="text-sm text-muted">This device was self-registered and does not use the pairing workflow.</p>;
  }

  if (isBound) {
    return <InlineAlert tone="success">This device is already bound to a physical installation. Use "Require re-pair" to issue a new pairing.</InlineAlert>;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1 text-sm">
        <p><span className="font-semibold">Device:</span> {device.deviceName}</p>
        <p><span className="font-semibold">Agency:</span> {device.agencyId ?? "-"}</p>
        <p><span className="font-semibold">Officer:</span> {device.assignedUserId ?? "Unassigned"}</p>
        <p><span className="font-semibold">Role:</span> {device.operationalRole ?? "Not set"}</p>
      </div>

      {!canIssue ? (
        <InlineAlert tone="warning">Assign a permission profile before issuing a pairing code.</InlineAlert>
      ) : null}

      {!pairing ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-ink">
            <span>Code validity</span>
            <SelectInput value={ttlMinutes} onChange={(event) => setTtlMinutes(event.target.value)}>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="240">4 hours</option>
              <option value="1440">24 hours</option>
            </SelectInput>
          </label>
          <Button disabled={!canIssue || busy !== null} onClick={() => void callPairingApi("pairing-code", "issue")}>
            {busy === "issue" ? "Generating…" : "Generate pairing QR"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <PairingQrCode value={pairing.qrPayload} size={220} />
          <div className="grid gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Manual pairing code</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded-md border border-line bg-surfaceMuted px-3 py-2 text-lg font-bold tracking-wider">{pairing.shortCode}</code>
                <Button variant="secondary" onClick={() => void copyCode()}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <p className="text-sm">
              <span className="font-semibold">Expires:</span> {new Date(pairing.expiresAt).toLocaleString()} ({formatCountdown(pairing.expiresAt)}
              {" "}remaining)
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy !== null} onClick={() => void callPairingApi("regenerate-pairing", "regenerate")}>
                {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
              </Button>
              <Button variant="danger" disabled={busy !== null} onClick={() => void callPairingApi("cancel-pairing", "cancel")}>
                {busy === "cancel" ? "Cancelling…" : "Cancel pairing"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
