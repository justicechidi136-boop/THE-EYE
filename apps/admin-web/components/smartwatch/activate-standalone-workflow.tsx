"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

  const qrUrl = result ? `https://quickchart.io/qr?text=${encodeURIComponent(result.qrPayload)}&size=220&margin=1` : null;

  return (
    <div className="grid gap-4">
      <form className="grid gap-3 lg:grid-cols-[1fr_120px_180px]" onSubmit={issueSecret}>
        <input
          className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye"
          placeholder="Standalone device ID (e.g. EYE-WATCH-001)"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          required
        />
        <input
          className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye"
          placeholder="TTL min"
          value={ttlMinutes}
          onChange={(event) => setTtlMinutes(event.target.value)}
        />
        <Button type="submit" disabled={busy}>
          Generate activation secret
        </Button>
      </form>
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {result ? (
        <div className="grid gap-4 rounded-lg border border-line bg-surfaceMuted p-4 lg:grid-cols-[220px_1fr]">
          {qrUrl ? <img src={qrUrl} alt={`Activation QR for ${result.deviceId}`} className="rounded-md border border-line bg-white p-2" /> : null}
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
