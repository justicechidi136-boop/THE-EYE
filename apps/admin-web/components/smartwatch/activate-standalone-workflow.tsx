"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PairingQrCode } from "../field-operations/pairing-qr-code";
import { Button, InlineAlert } from "../form-primitives";

type ActivationResult = {
  deviceId: string;
  pairingCode: string;
  expiresAt: string;
  qrPayload: string;
};

export function ActivateStandaloneWorkflow({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActivationResult | null>(null);

  if (!canManage) {
    return <InlineAlert tone="warning">Only administrators with user management permission can issue activation secrets.</InlineAlert>;
  }

  async function issueSecret(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/smartwatch/activation-secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId.trim(),
          ttlMinutes: Number.parseInt(ttlMinutes, 10) || 10,
          connectivityMode: "StandaloneCellular",
        }),
      });
      const payload = (await response.json()) as { message?: string; data?: ActivationResult };
      if (!response.ok || !payload.data) throw new Error(payload.message ?? "Failed to issue activation secret");
      setResult(payload.data);
      router.refresh();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "Failed to issue activation secret");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form className="grid gap-3 lg:grid-cols-[1fr_120px_180px]" onSubmit={issueSecret}>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Device ID
          <input
            className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-eye"
            placeholder="EYE-WATCH-001"
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Valid for
          <select
            className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-eye"
            value={ttlMinutes}
            onChange={(event) => setTtlMinutes(event.target.value)}
          >
            <option value="10">10 min</option>
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
          </select>
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Generating..." : "Generate code"}
        </Button>
      </form>
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {result ? (
        <div className="grid gap-4 rounded-lg border border-line bg-surfaceMuted p-4 lg:grid-cols-[220px_1fr]">
          <PairingQrCode value={result.qrPayload} alt={`Activation QR for ${result.deviceId}`} />
          <div className="grid gap-2 text-sm">
            <p><span className="font-semibold">Device ID:</span> {result.deviceId}</p>
            <p><span className="font-semibold">One-time pairing code:</span> {result.pairingCode}</p>
            <p><span className="font-semibold">Expires:</span> {new Date(result.expiresAt).toLocaleString()}</p>
            <p className="text-muted">Scan the QR code on the watch or enter the pairing code during standalone registration. This secret is shown once.</p>
            <textarea className="min-h-[88px] w-full rounded-md border border-line bg-white p-2 font-mono text-xs" readOnly value={result.qrPayload} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
