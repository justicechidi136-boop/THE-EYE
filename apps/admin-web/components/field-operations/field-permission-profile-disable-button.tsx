"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

export function FieldPermissionProfileDisableButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisable() {
    if (!window.confirm("Disable this permission profile? Devices already assigned keep their current effective permissions until reassigned.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/field-permission-profiles/${encodeURIComponent(profileId)}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Disabled from admin console" }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to disable profile");
      router.refresh();
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Failed to disable profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button variant="danger" disabled={busy} onClick={() => void handleDisable()}>
        {busy ? "Disabling…" : "Disable profile"}
      </Button>
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
