"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import type { BroadcastTargetOptions } from "../../lib/api/data";

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

const selectClass = "h-11 min-w-0 rounded-md border border-line bg-surface px-3 text-ink";

export function UserDirectoryFilters({ options }: { options: BroadcastTargetOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const country = searchParams.get("country") ?? "";
  const state = searchParams.get("state") ?? "";
  const lga = searchParams.get("lga") ?? "";
  const cityId = searchParams.get("cityId") ?? "";
  const countries = unique(options.jurisdictions.map((item) => item.country));
  const states = unique(options.jurisdictions.filter((item) => !country || item.country === country).map((item) => item.state));
  const lgas = unique(options.jurisdictions.filter((item) => (!country || item.country === country) && (!state || item.state === state)).map((item) => item.lga));
  const cities = options.communities.filter((item) =>
    (!country || item.country === country)
    && (!state || item.state === state)
    && (!lga || item.lga === lga),
  ).filter((item) => item.level === "CityTown");
  const communities = options.communities.filter((item) =>
    (!country || item.country === country)
    && (!state || item.state === state)
    && (!lga || item.lga === lga)
    && ["Community", "Estate", "Street"].includes(item.level)
    && (!cityId || item.parentId === cityId),
  );

  function update(name: string, value: string, clear: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    for (const key of clear) params.delete(key);
    params.delete("cursor");
    params.delete("history");
    params.set("page", "1");
    router.push(`/users${params.size ? `?${params.toString()}` : ""}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    update("q", value);
  }

  return (
    <div className="grid gap-4">
      <form className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submitSearch}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-muted">Search</span>
          <input name="q" type="search" defaultValue={searchParams.get("q") ?? ""} placeholder="Search by name, email, phone or user ID…" className="h-11 rounded-md border border-line bg-surface px-3 text-ink" />
        </label>
        <button type="submit" className="h-11 self-end rounded-md bg-eye px-4 text-sm font-semibold text-white hover:bg-eyeDeep">Search</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Role</span><select className={selectClass} value={searchParams.get("kind") ?? ""} onChange={(event) => update("kind", event.target.value)}><option value="">All</option><option value="citizen">Citizen</option><option value="admin">Admin</option></select></label>
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Account status</span><select className={selectClass} value={searchParams.get("status") ?? ""} onChange={(event) => update("status", event.target.value)}><option value="">All</option><option value="active">Active</option><option value="pending">Pending activation</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></label>
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Country</span><select className={selectClass} value={country} onChange={(event) => update("country", event.target.value, ["state", "lga", "cityId", "communityId"])}><option value="">All countries</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">State</span><select className={selectClass} value={state} disabled={!country} onChange={(event) => update("state", event.target.value, ["lga", "cityId", "communityId"])}><option value="">All states</option>{states.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">LGA / Area Council</span><select className={selectClass} value={lga} disabled={!state} onChange={(event) => update("lga", event.target.value, ["cityId", "communityId"])}><option value="">All LGAs / Area Councils</option>{lgas.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">City / Town</span><select className={selectClass} value={cityId} disabled={!lga || cities.length === 0} onChange={(event) => update("cityId", event.target.value, ["communityId"])}><option value="">All cities / towns</option>{cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm"><span className="font-medium text-muted">Community / Neighborhood</span><select className={selectClass} value={searchParams.get("communityId") ?? ""} disabled={!lga || communities.length === 0} onChange={(event) => update("communityId", event.target.value)}><option value="">All communities / neighborhoods</option>{communities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <div><Link href="/users" className="text-sm font-semibold text-eye hover:underline">Reset filters</Link></div>
    </div>
  );
}
