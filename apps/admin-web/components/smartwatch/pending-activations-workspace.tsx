"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PairingSessionView } from "../../lib/types/admin-views";
import { Button, InlineAlert } from "../form-primitives";

export function PendingActivationsWorkspace({
  sessions,
  canManage,
}: {
  sessions: PairingSessionView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function revoke(deviceId: string) {
    if (!window.confirm(`Reject and revoke activation secret for ${deviceId}?`)) return;
    setBusy(`reject-${deviceId}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/smartwatch/pairing-sessions/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Reject failed");
      setMessage(`Rejected activation for ${deviceId}.`);
      router.refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  }

  async function approve(session: PairingSessionView) {
    if (!session.deviceInternalId) {
      setError(`${session.deviceId} has not completed pairing on the watch yet.`);
      return;
    }
    if (session.isDeviceActive) {
      setMessage(`${session.deviceId} is already active.`);
      return;
    }
    setBusy(`approve-${session.deviceId}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/smartwatch/devices/${encodeURIComponent(session.deviceInternalId)}/activate`, { method: "PATCH" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Approve failed");
      setMessage(`Approved and activated ${session.deviceId}.`);
      router.refresh();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Approve failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-surfaceMuted text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Device ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner / state</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sessions.length ? sessions.map((session) => (
              <tr key={session.id}>
                <td className="px-4 py-3 font-semibold">
                  {session.deviceInternalId ? (
                    <Link href={`/devices/smart-watches/${session.deviceInternalId}`} className="text-eye hover:underline">{session.deviceId}</Link>
                  ) : (
                    session.deviceId
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{session.status}</td>
                <td className="px-4 py-3">{session.owner}</td>
                <td className="px-4 py-3">{session.connectivityMode}</td>
                <td className="px-4 py-3">{new Date(session.expiresAt).toLocaleString()}</td>
                <td className="px-4 py-3">{new Date(session.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {canManage && session.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={busy !== null}
                        onClick={() => approve(session)}
                      >
                        Approve
                      </Button>
                      <Button disabled={busy !== null} variant="danger" onClick={() => revoke(session.deviceId)}>
                        Reject
                      </Button>
                    </div>
                  ) : session.isDeviceActive ? (
                    <span className="text-muted">Active</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={7}>No pending activation sessions.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
