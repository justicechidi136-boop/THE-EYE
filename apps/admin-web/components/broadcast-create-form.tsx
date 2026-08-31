"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BroadcastType, IncidentPriority } from "@the-eye/shared";
import type { BroadcastTargetOptions } from "../lib/api/data";
import { Button, InlineAlert } from "./form-primitives";

const typeOptions = [
  { label: "Safety Alert", value: BroadcastType.SafetyAlert },
  { label: "Community Warning", value: BroadcastType.CommunityWarning },
  { label: "Government Alert", value: BroadcastType.GovernmentAlert },
  { label: "Public Advisory", value: BroadcastType.PublicAdvisory },
  { label: "Emergency Warning", value: BroadcastType.EmergencyWarning },
];

const priorityOptions = [
  { label: "P1 / Critical", value: IncidentPriority.P1LifeThreatening },
  { label: "P2 / High", value: IncidentPriority.P2ActiveCrimeAccident },
  { label: "P3 / Medium", value: IncidentPriority.P3SuspiciousActivity },
  { label: "P4 / Low", value: IncidentPriority.P4GeneralSafety },
];

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function BroadcastCreateForm({ targetOptions }: { targetOptions: BroadcastTargetOptions }) {
  const router = useRouter();
  const initialCountry = targetOptions.jurisdictions[0]?.country ?? "";
  const [type, setType] = useState<BroadcastType>(typeOptions[0].value);
  const [priority, setPriority] = useState<IncidentPriority>(priorityOptions[1].value);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [locationLevel, setLocationLevel] = useState<"Country" | "State" | "LGA" | "Community">("Country");
  const [country, setCountry] = useState(initialCountry);
  const [state, setState] = useState("");
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [communityQuery, setCommunityQuery] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"EntireArea" | "Radius">("EntireArea");
  const [radiusKm, setRadiusKm] = useState("3");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const countries = useMemo(() => unique(targetOptions.jurisdictions.map((item) => item.country)), [targetOptions]);
  const states = useMemo(
    () => unique(targetOptions.jurisdictions.filter((item) => item.country === country).map((item) => item.state)),
    [country, targetOptions],
  );
  const jurisdictions = useMemo(
    () => targetOptions.jurisdictions.filter((item) => item.country === country && (!state || item.state === state)),
    [country, state, targetOptions],
  );
  const selectedJurisdiction = jurisdictions.find((item) => item.id === jurisdictionId);
  const communities = useMemo(() => {
    const normalizedQuery = communityQuery.trim().toLowerCase();
    return targetOptions.communities.filter((item) =>
      item.country === country
      && (!state || item.state === state)
      && (!selectedJurisdiction || item.lga === selectedJurisdiction.lga)
      && (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery)),
    );
  }, [communityQuery, country, selectedJurisdiction, state, targetOptions]);
  const selectedCommunity = communities.find((item) => item.id === communityId)
    ?? targetOptions.communities.find((item) => item.id === communityId);
  const targetLevel = locationLevel;
  const targetLabel = locationLevel === "Community"
    ? selectedCommunity?.name
    : locationLevel === "LGA"
      ? selectedJurisdiction?.name
      : locationLevel === "State"
        ? state
        : country;

  function changeLocationLevel(value: "Country" | "State" | "LGA" | "Community") {
    setLocationLevel(value);
    if (value === "Country") {
      setState("");
      setJurisdictionId("");
      setCommunityId("");
    } else if (value === "State") {
      setJurisdictionId("");
      setCommunityId("");
    } else if (value === "LGA") {
      setCommunityId("");
    }
    setCommunityQuery("");
  }

  function changeCountry(value: string) {
    setCountry(value);
    setState("");
    setJurisdictionId("");
    setCommunityId("");
    setCommunityQuery("");
  }

  function changeState(value: string) {
    setState(value);
    setJurisdictionId("");
    setCommunityId("");
    setCommunityQuery("");
  }

  function changeJurisdiction(value: string) {
    setJurisdictionId(value);
    setCommunityId("");
    setCommunityQuery("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const radius = Number(radiusKm);
    if (!title.trim() || !body.trim()) {
      setError("Enter both a title and the public-facing message.");
      return;
    }
    if (!country) {
      setError("Select an authorized target country.");
      return;
    }
    if (locationLevel === "State" && !state) {
      setError("Select an authorized target state.");
      return;
    }
    if (locationLevel === "LGA" && !selectedJurisdiction) {
      setError("Select an authorized target City / LGA.");
      return;
    }
    if (locationLevel === "Community" && !selectedCommunity) {
      setError("Search for and select an authorized target community.");
      return;
    }
    if (deliveryMode === "Radius" && (!Number.isFinite(radius) || radius < 0.1 || radius > 50)) {
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
          country,
          state: state || undefined,
          lga: selectedJurisdiction?.lga,
          jurisdictionId: selectedJurisdiction?.id,
          communityId: selectedCommunity?.id,
          targetLevel,
          deliveryMode,
          radiusMeters: deliveryMode === "Radius" ? Math.round(radius * 1000) : undefined,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Broadcast creation failed");
      setMessage(`“${title.trim()}” was published to ${targetLabel}.`);
      setTitle("");
      setBody("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Broadcast creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,180px)]">
        <label className="grid min-w-0 gap-2 text-sm font-medium">Broadcast type<select className="h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-eye" value={type} onChange={(event) => setType(event.target.value as BroadcastType)}>{typeOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Title<input className="h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-eye" placeholder="Area safety alert" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Priority<select className="h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-eye" value={priority} onChange={(event) => setPriority(event.target.value as IncidentPriority)}>{priorityOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
      </div>

      <label className="grid gap-2 text-sm font-medium">Message / content<textarea className="min-h-28 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 outline-none focus:border-eye" placeholder="Write the public-facing broadcast message recipients will see…" value={body} onChange={(event) => setBody(event.target.value)} /></label>

      <fieldset className="grid gap-4 rounded-lg border border-line p-4">
        <legend className="px-2 text-sm font-semibold text-ink">Target area</legend>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">Location level<select className="h-11 rounded-md border border-line bg-surface px-3" value={locationLevel} onChange={(event) => changeLocationLevel(event.target.value as "Country" | "State" | "LGA" | "Community")}><option value="Country">Country</option><option value="State">State</option><option value="LGA">City / LGA</option><option value="Community">Community</option></select></label>
          <label className="grid gap-2 text-sm font-medium">Country<select className="h-11 rounded-md border border-line bg-surface px-3" value={country} onChange={(event) => changeCountry(event.target.value)} disabled={!countries.length}><option value="">Select country</option>{countries.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          {locationLevel !== "Country" ? <label className="grid gap-2 text-sm font-medium">State<select className="h-11 rounded-md border border-line bg-surface px-3" value={state} onChange={(event) => changeState(event.target.value)} disabled={!country}><option value="">Select state</option>{states.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label> : null}
          {locationLevel === "LGA" || locationLevel === "Community" ? <label className="grid gap-2 text-sm font-medium">City / LGA<select className="h-11 rounded-md border border-line bg-surface px-3" value={jurisdictionId} onChange={(event) => changeJurisdiction(event.target.value)} disabled={!state}><option value="">Select City / LGA</option>{jurisdictions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name || entry.lga}</option>)}</select></label> : null}
          {locationLevel === "Community" ? <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="broadcast-community-search">Community</label>
            <input id="broadcast-community-search" className="h-11 rounded-md border border-line bg-surface px-3" placeholder="Search community" value={communityQuery} onChange={(event) => { setCommunityQuery(event.target.value); setCommunityId(""); }} disabled={!jurisdictionId} />
            <select aria-label="Select community" className="h-11 rounded-md border border-line bg-surface px-3" value={communityId} onChange={(event) => setCommunityId(event.target.value)} disabled={!jurisdictionId}>
              <option value="">Select community</option>
              {communities.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </div> : null}
        </div>
        <p className="text-xs text-muted">Target: {targetLabel || "Select the required area"}. Selections resolve to authorized geographic IDs; changing a parent area clears its dependent selections.</p>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-ink">Delivery scope</legend>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="deliveryMode" checked={deliveryMode === "EntireArea"} onChange={() => setDeliveryMode("EntireArea")} />Entire {targetLabel || "selected area"}</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="deliveryMode" checked={deliveryMode === "Radius"} onChange={() => setDeliveryMode("Radius")} />Within radius</label>
          {deliveryMode === "Radius" ? <label className="flex items-center gap-2 text-sm"><input aria-label="Delivery radius in kilometres" type="number" min="0.1" max="50" step="0.1" className="h-10 w-24 rounded-md border border-line bg-surface px-3" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)} />km</label> : null}
        </div>
      </fieldset>

      <div><Button type="submit" disabled={submitting || !targetOptions.jurisdictions.length}>{submitting ? "Publishing…" : "Create Broadcast"}</Button></div>
      {!targetOptions.jurisdictions.length ? <InlineAlert tone="error"><span>No authorized target areas are available for this account.</span></InlineAlert> : null}
      {error ? <InlineAlert tone="error"><span>{error}</span></InlineAlert> : null}
      {message ? <InlineAlert tone="success"><span>{message}</span></InlineAlert> : null}
    </form>
  );
}
