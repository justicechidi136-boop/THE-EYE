"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PoliceStationView } from "../../lib/types/admin-views";
import type { PoliceVerificationStatus } from "../../lib/police-stations/types";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import { Panel, StatusBadge } from "../ui";

const verificationActions: Array<{ label: string; status: PoliceVerificationStatus; tone: "primary" | "secondary" | "danger" }> = [
  { label: "Verify Official", status: "VerifiedOfficial", tone: "primary" },
  { label: "Verify by Admin", status: "VerifiedByAdmin", tone: "primary" },
  { label: "Mark Unverified", status: "Unverified", tone: "secondary" },
  { label: "Mark Closed", status: "Closed", tone: "danger" },
  { label: "Flag Duplicate", status: "Duplicate", tone: "danger" },
  { label: "Reactivate", status: "VerifiedByAdmin", tone: "secondary" },
];

export function PoliceStationVerificationPanel({ station }: { station: PoliceStationView }) {
  const router = useRouter();
  const [source, setSource] = useState(station.source !== "-" ? station.source : "");
  const [sourceReference, setSourceReference] = useState(station.sourceReference !== "-" ? station.sourceReference : "");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<PoliceVerificationStatus>("VerifiedByAdmin");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitVerification(status: PoliceVerificationStatus) {
    if (!source.trim() || !sourceReference.trim()) {
      setError("Source and source reference are required for verification actions.");
      return;
    }
    if (status === "VerifiedOfficial" && /google places|google maps|places api/i.test(source)) {
      setError("Google-only sources cannot be used for Verified Official status.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/police-stations/${station.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officialName: station.name,
          address: station.address,
          latitude: station.latitude,
          longitude: station.longitude,
          verificationStatus: status,
          source: source.trim(),
          sourceReference: sourceReference.trim(),
          officialPhone: station.officialPhone !== "-" ? station.officialPhone : undefined,
          emergencyPhone: station.emergencyPhone !== "-" ? station.emergencyPhone : undefined,
          verificationNotes: verificationNotes.trim() || undefined,
        }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Verification update failed");
      setMessage(`Verification updated to ${status}.`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Verification update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Verification workflow">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge tone={station.isActive ? "success" : "danger"}>{station.verificationStatus}</StatusBadge>
        {!station.isActive ? <StatusBadge tone="danger">Inactive</StatusBadge> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <FormField label="Verification source" htmlFor="verify-source">
          <TextInput id="verify-source" value={source} onChange={(event) => setSource(event.target.value)} />
        </FormField>
        <FormField label="Source reference" htmlFor="verify-source-ref">
          <TextInput id="verify-source-ref" value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} />
        </FormField>
        <FormField label="Selected action" htmlFor="verify-status">
          <SelectInput id="verify-status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as PoliceVerificationStatus)}>
            {verificationActions.map((action) => <option key={action.label} value={action.status}>{action.label}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Verification notes" htmlFor="verify-notes">
          <TextInput id="verify-notes" value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} placeholder="Reason and review notes" />
        </FormField>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {verificationActions.map((action) => (
          <Button
            key={action.label}
            variant={action.tone}
            disabled={submitting}
            onClick={() => void submitVerification(action.status)}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="primary" disabled={submitting} onClick={() => void submitVerification(selectedStatus)}>
          Apply selected action
        </Button>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
    </Panel>
  );
}
