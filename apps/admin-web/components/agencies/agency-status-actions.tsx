"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, InlineAlert } from "../form-primitives";

type AgencyStatusActionsProps = {
  agencyId: string;
  isActive: boolean;
};

export function AgencyStatusActions({ agencyId, isActive }: AgencyStatusActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: "activate" | "deactivate") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/agencies/${encodeURIComponent(agencyId)}/${action}`, {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `Failed to ${action} agency`);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} agency`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {isActive ? (
        <Button variant="danger" disabled={busy} onClick={() => void runAction("deactivate")}>
          {busy ? "Working…" : "Deactivate agency"}
        </Button>
      ) : (
        <Button disabled={busy} onClick={() => void runAction("activate")}>
          {busy ? "Working…" : "Activate agency"}
        </Button>
      )}
    </div>
  );
}
