"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../form-primitives";

type Props = {
  incidentId: string;
  incidentTitle: string;
  canLaunch: boolean;
};

export function LaunchDroneMissionButton({ incidentId, incidentTitle, canLaunch }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canLaunch) return null;

  async function launch() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/drone-surveillance/missions/from-incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          title: `Aerial surveillance — ${incidentTitle}`,
          priority: "P2",
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to launch drone mission");
      }
      const payload = (await response.json()) as { data?: { id?: string } };
      const missionId = payload.data?.id;
      router.push(missionId ? `/drone-surveillance/missions/${missionId}` : `/drone-surveillance/map?incident=${incidentId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch drone mission");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-semibold text-ink">Drone surveillance</p>
      <p className="text-xs text-muted">
        Launch an aerial mission locked to this incident GPS. Evidence captured in-flight can be linked back to the incident record.
      </p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button type="button" disabled={loading} onClick={launch}>
        {loading ? "Launching…" : "Launch drone mission"}
      </Button>
    </div>
  );
}
