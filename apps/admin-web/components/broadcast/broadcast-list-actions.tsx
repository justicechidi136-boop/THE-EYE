"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

type Props = {
  broadcastId: string;
  status: string;
  adminVerified: boolean;
  authorLabel: "Citizen" | "Admin" | "Verified";
};

export function BroadcastListActions({ broadcastId, status, adminVerified, authorLabel }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suspended = status === "Suspended";
  const terminal = status === "Resolved" || status === "DeletedByAdmin" || status === "WithdrawnByAuthor";

  async function runAction(action: string, body: Record<string, unknown> = {}, method: "POST" | "PATCH" | "DELETE" = "POST") {
    if (action === "delete" && !window.confirm("Delete this broadcast from the Admin workspace?")) return;
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/broadcasts/${broadcastId}/${action}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `${action} failed`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center gap-2">
        <Link href={`/broadcasts/${broadcastId}`} className="rounded-md bg-eye px-3 py-2 text-xs font-semibold text-white hover:bg-eye/90 focus:outline-none focus:ring-2 focus:ring-accent">
          View
        </Link>
        {!terminal ? (
          <Button className="min-h-9 px-3 py-2 text-xs" disabled={busy !== null} variant={suspended ? "secondary" : "danger"} onClick={() => runAction(suspended ? "restore" : "suspend", suspended ? {} : { reason: "Suspended from admin workspace" })}>
            {suspended ? "Restore" : "Suspend"}
          </Button>
        ) : null}
        <details className="relative">
          <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-md border border-line bg-surface text-lg font-bold text-ink hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent" aria-label="More actions">
            ⋯
          </summary>
          <div className="absolute right-0 z-30 mt-2 grid min-w-52 gap-1 rounded-md border border-line bg-surface p-2 shadow-xl">
            {!adminVerified && authorLabel !== "Admin" ? <button className="rounded px-3 py-2 text-left text-sm hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("verify", { note: "Verified from admin workspace" })}>Verify</button> : null}
            <button className="rounded px-3 py-2 text-left text-sm hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("comment", { body: "Official update posted from admin workspace." })}>Quick official comment</button>
            {status === "Published" ? <button className="rounded px-3 py-2 text-left text-sm hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("dispatch", {}, "POST")}>Dispatch</button> : null}
            {status === "Published" || status === "Failed" ? <button className="rounded px-3 py-2 text-left text-sm hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("retry", {}, "POST")}>Retry failed</button> : null}
            <button className="rounded px-3 py-2 text-left text-sm hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("preview", {}, "PATCH")}>Preview</button>
            <button className="rounded px-3 py-2 text-left text-sm hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("estimate", {}, "PATCH")}>Estimate delivery</button>
            <button className="rounded px-3 py-2 text-left text-sm hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("progress", {}, "PATCH")}>Delivery progress</button>
            {!terminal ? <button className="rounded px-3 py-2 text-left text-sm text-danger hover:bg-surfaceMuted" disabled={busy !== null} onClick={() => runAction("delete", { reason: "Removed from admin workspace" }, "DELETE")}>Delete</button> : null}
          </div>
        </details>
      </div>
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
