"use client";

import { useState } from "react";
import { BroadcastType, IncidentPriority } from "@the-eye/shared";
import { Button, InlineAlert } from "./form-primitives";

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

type LocationResult = { label: string; latitude: number; longitude: number };

export function BroadcastCreateForm() {
  const [type, setType] = useState<BroadcastType>(typeOptions[0].value);
  const [priority, setPriority] = useState<IncidentPriority>(priorityOptions[1].value);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locations, setLocations] = useState<LocationResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [radiusKm, setRadiusKm] = useState("3");
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function searchLocations() {
    if (locationQuery.trim().length < 3) {
      setError("Enter at least 3 characters to search for a target location.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/locations/search?q=${encodeURIComponent(locationQuery.trim())}`);
      const payload = (await response.json()) as { data?: LocationResult[]; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Location search failed");
      setLocations(payload.data ?? []);
      if (!payload.data?.length) setError("No matching Nigerian location was found.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Location search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const radius = Number(radiusKm);
    if (!title.trim() || !body.trim()) {
      setError("Enter both a title and the public-facing message.");
      return;
    }
    if (!selectedLocation) {
      setError("Search for and select the target location.");
      return;
    }
    if (!Number.isFinite(radius) || radius <= 0 || radius > 50) {
      setError("Delivery radius must be between 0.1 and 50 km.");
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
          body: body.trim(),
          priority,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          radiusMeters: Math.round(radius * 1000),
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Broadcast creation failed");
      setMessage(`“${title.trim()}” was submitted through the approved Broadcast workflow.`);
      setTitle("");
      setBody("");
      setLocationQuery("");
      setLocations([]);
      setSelectedLocation(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Broadcast creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,150px)]">
        <label className="grid min-w-0 gap-2 text-sm font-medium">Type<select className="h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-eye" value={type} onChange={(event) => setType(event.target.value as BroadcastType)}>{typeOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Title<input className="h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-eye" placeholder="Area safety alert" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Priority<select className="h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-eye" value={priority} onChange={(event) => setPriority(event.target.value as IncidentPriority)}>{priorityOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
      </div>

      <label className="grid gap-2 text-sm font-medium">Message / content<textarea className="min-h-28 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 outline-none focus:border-eye" placeholder="Write the public-facing broadcast message recipients will see…" value={body} onChange={(event) => setBody(event.target.value)} /></label>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,160px)]">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="broadcast-location-search">Target location</label>
          <div className="flex min-w-0 gap-2">
            <input id="broadcast-location-search" className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 outline-none focus:border-eye" placeholder="Search a neighborhood, LGA, or address…" value={locationQuery} onChange={(event) => { setLocationQuery(event.target.value); setSelectedLocation(null); }} />
            <Button type="button" variant="secondary" disabled={searching} onClick={searchLocations}>{searching ? "Searching…" : "Search"}</Button>
          </div>
          {locations.length ? (
            <div className="grid gap-1 rounded-md border border-line bg-surface p-1" role="listbox" aria-label="Location results">
              {locations.map((location) => <button type="button" key={`${location.latitude}-${location.longitude}`} className={`rounded px-3 py-2 text-left text-sm ${selectedLocation === location ? "bg-eye text-white" : "hover:bg-surfaceMuted"}`} onClick={() => { setSelectedLocation(location); setLocationQuery(location.label); }}>{location.label}</button>)}
            </div>
          ) : null}
          {selectedLocation ? <p className="text-xs text-success">Target selected. Coordinates will be sent internally and are not displayed publicly.</p> : null}
        </div>
        <label className="grid content-start gap-2 text-sm font-medium">Delivery radius<div className="relative"><input type="number" min="0.1" max="50" step="0.1" className="h-11 w-full rounded-md border border-line bg-surface px-3 pr-10 outline-none focus:border-eye" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)} /><span className="absolute right-3 top-3 text-sm text-muted">km</span></div></label>
      </div>

      <div><Button type="submit" disabled={submitting}>{submitting ? "Broadcasting…" : "Broadcast"}</Button></div>
      {error ? <InlineAlert tone="error"><span>{error}</span></InlineAlert> : null}
      {message ? <InlineAlert tone="success"><span>{message}</span></InlineAlert> : null}
    </form>
  );
}
