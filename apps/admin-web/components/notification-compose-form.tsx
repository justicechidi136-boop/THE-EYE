"use client";

import { useState } from "react";
import { Button, FormField, TextInput, InlineAlert } from "./form-primitives";

const channels = [
  { label: "Push", value: "push" },
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
  { label: "In-app", value: "in_app" },
];
const priorities = ["Critical", "High", "Normal", "Low"];
const notificationTypes = [
  "EmergencyAlert",
  "NearbyDangerWarning",
  "FamilySosAlert",
  "BroadcastAlert",
  "MissingPersonAlert",
  "StolenVehicleAlert",
  "AdminAssignmentAlert",
];

function parseTarget(value: string) {
  const parts = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (parts.length < 2) return {};
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  const radiusMeters = parts[2] ? Number(parts[2]) : 3000;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  return { latitude, longitude, radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : 3000 };
}

export function NotificationComposeForm() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(notificationTypes[0]);
  const [channel, setChannel] = useState(channels[0].value);
  const [priority, setPriority] = useState(priorities[0]);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a notification title.");
      setMessage(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: `${title.trim()} notification dispatched from admin console.`,
          type,
          priority,
          channels: [channel],
          ...parseTarget(target),
        }),
      });
      const payload = (await response.json()) as { message?: string; data?: { id?: string } };
      if (!response.ok) throw new Error(payload.message ?? "Notification dispatch failed");
      setMessage(`Notification "${title}" queued via POST /v1/notifications/send${payload.data?.id ? ` (${payload.data.id})` : ""}.`);
      setTitle("");
      setTarget("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Notification dispatch failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 lg:grid-cols-5">
        <FormField label="Title">
          <TextInput placeholder="Emergency area alert" value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormField>
        <FormField label="Type">
          <select className="h-11 w-full rounded-md border border-line px-3" value={type} onChange={(event) => setType(event.target.value)}>
            {notificationTypes.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </FormField>
        <FormField label="Channel">
          <select className="h-11 w-full rounded-md border border-line px-3" value={channel} onChange={(event) => setChannel(event.target.value)}>
            {channels.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select className="h-11 w-full rounded-md border border-line px-3" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {priorities.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </FormField>
        <FormField label="Target area">
          <TextInput placeholder="Lat, lng, radius" value={target} onChange={(event) => setTarget(event.target.value)} />
        </FormField>
      </div>
      <Button type="submit" className="w-fit" disabled={submitting}>{submitting ? "Queueing…" : "Queue notification"}</Button>
      {error ? <InlineAlert tone="error"><span>{error}</span></InlineAlert> : null}
      {message ? <InlineAlert tone="success"><span>{message}</span></InlineAlert> : null}
      <p className="text-sm text-muted">Location targeting accepts `latitude, longitude, radiusMeters`. Direct user targeting requires `userId` or `adminUserId` support in a future form field.</p>
    </form>
  );
}
