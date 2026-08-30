"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BroadcastTargetOptions } from "../../lib/api/data";

const TYPE_OPTIONS = [
  ["MissingPerson", "Missing Person"],
  ["StolenVehicle", "Stolen Vehicle"],
  ["SafetyAlert", "Safety Alert"],
  ["CommunityWarning", "Community Warning"],
  ["GovernmentAlert", "Government Alert"],
  ["PublicAdvisory", "Public Advisory"],
  ["EmergencyWarning", "Emergency Warning"],
];

const STATUS_OPTIONS = [
  ["Published", "Published"],
  ["Active", "Active"],
  ["Expired", "Expired"],
  ["Cancelled", "Cancelled"],
  ["PendingApproval", "Pending approval"],
  ["Scheduled", "Scheduled"],
  ["Suspended", "Suspended"],
  ["Resolved", "Resolved"],
];

type FilterDefaults = {
  country?: string;
  state?: string;
  lga?: string;
  communityId?: string;
  status?: string;
  category?: string;
  author?: string;
  search?: string;
  time?: string;
  from?: string;
  to?: string;
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function BroadcastFilters({
  defaults,
  targetOptions,
}: {
  defaults?: FilterDefaults;
  targetOptions: BroadcastTargetOptions;
}) {
  const [country, setCountry] = useState(defaults?.country ?? "");
  const [state, setState] = useState(defaults?.state ?? "");
  const [lga, setLga] = useState(defaults?.lga ?? "");
  const [communityId, setCommunityId] = useState(defaults?.communityId ?? "");
  const countries = useMemo(() => unique(targetOptions.jurisdictions.map((item) => item.country)), [targetOptions]);
  const states = useMemo(
    () => unique(targetOptions.jurisdictions.filter((item) => !country || item.country === country).map((item) => item.state)),
    [country, targetOptions],
  );
  const lgas = useMemo(
    () => unique(targetOptions.jurisdictions.filter((item) => (!country || item.country === country) && (!state || item.state === state)).map((item) => item.lga)),
    [country, state, targetOptions],
  );
  const communities = useMemo(
    () => targetOptions.communities.filter((item) =>
      (!country || item.country === country)
      && (!state || item.state === state)
      && (!lga || item.lga === lga)),
    [country, lga, state, targetOptions],
  );
  const [time, setTime] = useState(defaults?.time ?? "");

  const fieldClass = "h-10 min-w-0 rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-eye focus:ring-2 focus:ring-eye/20";

  return (
    <form method="get" className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">Search<input name="search" className={fieldClass} defaultValue={defaults?.search} placeholder="Title, author, or location…" /></label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">Type<select name="category" className={fieldClass} defaultValue={defaults?.category}><option value="">All</option>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">Status<select name="status" className={fieldClass} defaultValue={defaults?.status}><option value="">All statuses</option>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">Author<select name="author" className={fieldClass} defaultValue={defaults?.author}><option value="">All authors</option><option value="Citizen">Citizen</option><option value="Admin">Admin</option></select></label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">Country<select name="country" className={fieldClass} value={country} onChange={(event) => { setCountry(event.target.value); setState(""); setLga(""); setCommunityId(""); }}><option value="">All countries</option>{countries.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">State<select name="state" className={fieldClass} value={state} onChange={(event) => { setState(event.target.value); setLga(""); setCommunityId(""); }} disabled={!country}><option value="">All states</option>{states.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">City / LGA<select name="lga" className={fieldClass} value={lga} onChange={(event) => { setLga(event.target.value); setCommunityId(""); }} disabled={!state}><option value="">All cities / LGAs</option>{lgas.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">Community<select name="communityId" className={fieldClass} value={communityId} onChange={(event) => setCommunityId(event.target.value)} disabled={!lga}><option value="">All communities</option>{communities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>

      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,180px)_minmax(0,180px)_auto]">
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">Time<select name="time" className={fieldClass} value={time} onChange={(event) => setTime(event.target.value)}><option value="">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="custom">Custom range</option></select></label>
        {time === "custom" ? <label className="grid gap-1 text-xs font-semibold uppercase text-muted">From<input type="date" name="from" className={fieldClass} defaultValue={defaults?.from} /></label> : <span />}
        {time === "custom" ? <label className="grid gap-1 text-xs font-semibold uppercase text-muted">To<input type="date" name="to" className={fieldClass} defaultValue={defaults?.to} /></label> : <span />}
        <div className="flex gap-2">
          <button type="submit" className="h-10 rounded-md bg-eye px-4 text-sm font-semibold text-white hover:bg-eye/90">Apply filters</button>
          <Link href="/broadcasts" className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-accent">Reset</Link>
        </div>
      </div>
    </form>
  );
}
