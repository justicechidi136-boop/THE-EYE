"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PoliceStationView } from "../../lib/types/admin-views";
import { PoliceStationForm } from "./police-station-form";
import { PoliceStationVerificationPanel } from "./police-station-verification-panel";
import { InlineAlert } from "../form-primitives";
import { PageHeader, Panel, StatusBadge } from "../ui";

export function PoliceStationDetailClient({ station }: { station: PoliceStationView }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(payload: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/police-stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as { message?: string; duplicates?: unknown[] };
    if (!response.ok) {
      if (body.duplicates) throw new Error(`${body.message ?? "Duplicate records detected"}. Provide an override reason.`);
      throw new Error(body.message ?? "Update failed");
    }
    setMessage("Station updated successfully.");
    setMode("view");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Police station detail"
        title={station.name}
        action={<StatusBadge tone={station.isActive ? "success" : "danger"}>{station.verificationStatus}</StatusBadge>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Link className="font-semibold text-eye" href="/police-stations">Back to list</Link>
        <button className="font-semibold text-eye" type="button" onClick={() => setMode(mode === "edit" ? "view" : "edit")}>
          {mode === "edit" ? "Cancel edit" : "Edit station"}
        </button>
      </div>

      {mode === "edit" ? (
        <PoliceStationForm
          title="Edit police station"
          submitLabel="Save changes"
          excludeStationId={station.id}
          initialValues={{
            name: station.name,
            stationType: station.stationType,
            country: station.country,
            state: station.state,
            lga: station.lga,
            address: station.address,
            latitude: String(station.latitude),
            longitude: String(station.longitude),
            officialPhone: station.officialPhone !== "-" ? station.officialPhone : "",
            emergencyPhone: station.emergencyPhone !== "-" ? station.emergencyPhone : "",
            source: station.source !== "-" ? station.source : "",
            sourceReference: station.sourceReference !== "-" ? station.sourceReference : "",
            verificationStatus: station.verificationStatus as never,
            isActive: station.isActive,
          }}
          onSubmit={async (payload, _duplicates) => {
            await handleUpdate(payload);
          }}
        />
      ) : (
        <Panel title="Station record">
          <dl className="grid gap-3 md:grid-cols-2 text-sm">
            <div><dt className="text-muted">Address</dt><dd className="font-medium">{station.address}</dd></div>
            <div><dt className="text-muted">Jurisdiction</dt><dd className="font-medium">{station.country} / {station.state} / {station.lga}</dd></div>
            <div><dt className="text-muted">Coordinates</dt><dd className="font-medium">{station.latitude}, {station.longitude}</dd></div>
            <div><dt className="text-muted">Phones</dt><dd className="font-medium">{station.officialPhone} · {station.emergencyPhone}</dd></div>
            <div><dt className="text-muted">Source</dt><dd className="font-medium">{station.source}</dd></div>
            <div><dt className="text-muted">Source reference</dt><dd className="font-medium">{station.sourceReference}</dd></div>
          </dl>
          <p className="mt-4 text-sm">
            <a className="font-semibold text-eye underline" href={station.navigationUrl} target="_blank" rel="noreferrer">Open Google Maps preview</a>
          </p>
        </Panel>
      )}

      <PoliceStationVerificationPanel station={station} />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
    </>
  );
}
