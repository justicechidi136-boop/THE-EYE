"use client";

import { useState } from "react";
import { BroadcastType, IncidentPriority } from "@the-eye/shared";
import { Button } from "./form-primitives";
import { InlineAlert } from "./form-primitives";

const typeOptions = [
  { label: "Emergency", value: BroadcastType.Emergency },
  { label: "Crime", value: BroadcastType.Crime },
  { label: "Accident", value: BroadcastType.Accident },
  { label: "Missing person", value: BroadcastType.MissingPerson },
  { label: "Stolen vehicle", value: BroadcastType.StolenVehicle },
  { label: "Government alert", value: BroadcastType.GovernmentAlert },
  { label: "Community warning", value: BroadcastType.CommunityWarning },
];

const priorityOptions = [
  { label: "P1", value: IncidentPriority.P1LifeThreatening },
  { label: "P2", value: IncidentPriority.P2ActiveCrimeAccident },
  { label: "P3", value: IncidentPriority.P3SuspiciousActivity },
  { label: "P4", value: IncidentPriority.P4GeneralSafety },
];

function parseGeofence(value: string) {
  const parts = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (parts.length < 2) return {};
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  const radiusMeters = parts[2] ? Number(parts[2]) : 3000;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  return { latitude, longitude, radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : 3000 };
}

export function BroadcastCreateForm() {
  const [type, setType] = useState<BroadcastType>(typeOptions[0].value);
  const [priority, setPriority] = useState<IncidentPriority>(priorityOptions[1].value);
  const [title, setTitle] = useState("");
  const [geofence, setGeofence] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a broadcast title before sending for approval.");
      setMessage(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          body: `${title.trim()} alert for ${geofence || "assigned jurisdiction"}.`,
          priority,
          ...parseGeofence(geofence),
        }),
      });
      const payload = (await response.json()) as { message?: string; data?: { id?: string } };
      if (!response.ok) throw new Error(payload.message ?? "Broadcast creation failed");
      setMessage(`"${title}" queued via POST /v1/broadcasts${payload.data?.id ? ` (${payload.data.id})` : ""}.`);
      setTitle("");
      setGeofence("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Broadcast creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 lg:grid-cols-[220px_1fr_1fr_180px_180px]">
        <label className="grid gap-2 text-sm font-medium">
          Type
          <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" value={type} onChange={(event) => setType(event.target.value as BroadcastType)}>
            {typeOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Title
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Area safety alert" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Geofence
          <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Lat, lng, radius" value={geofence} onChange={(event) => setGeofence(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Priority
          <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" value={priority} onChange={(event) => setPriority(event.target.value as IncidentPriority)}>
            {priorityOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </label>
        <Button type="submit" className="self-end" disabled={submitting}>{submitting ? "Submitting…" : "Send for approval"}</Button>
      </div>
      {error ? <InlineAlert tone="error"><span>{error}</span></InlineAlert> : null}
      {message ? <InlineAlert tone="success"><span>{message}</span></InlineAlert> : null}
    </form>
  );
}
