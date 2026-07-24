"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PoliceStationView } from "../../lib/types/admin-views";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import { StatusBadge } from "../ui";
import { PoliceStationForm } from "./police-station-form";
import type { PoliceStationDuplicate } from "../../lib/police-stations/types";

function verificationTone(status: string): "success" | "warning" | "info" | "danger" {
  if (status === "VerifiedOfficial" || status === "VerifiedByAdmin") return "success";
  if (status === "Closed" || status === "Duplicate") return "danger";
  if (status === "Unverified") return "warning";
  return "info";
}

export function PoliceStationWorkspace({ initialStations }: { initialStations: PoliceStationView[] }) {
  const router = useRouter();
  const [stations, setStations] = useState(initialStations);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [lgaFilter, setLgaFilter] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return stations.filter((station) => {
      const haystack = `${station.name} ${station.address} ${station.state} ${station.lga}`.toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (stateFilter && !station.state.toLowerCase().includes(stateFilter.toLowerCase())) return false;
      if (lgaFilter && !station.lga.toLowerCase().includes(lgaFilter.toLowerCase())) return false;
      if (agencyFilter && station.agencyType !== agencyFilter) return false;
      return true;
    });
  }, [agencyFilter, lgaFilter, query, stateFilter, stations]);

  async function refreshList() {
    setLoading(true);
    setError(null);
    try {
      router.refresh();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh station list");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(payload: Record<string, unknown>, duplicates: PoliceStationDuplicate[]) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/police-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { message?: string; data?: PoliceStationView; duplicates?: PoliceStationDuplicate[] };
      if (!response.ok) {
        if (body.duplicates?.length) {
          throw new Error(`${body.message ?? "Duplicate records detected"}. Review matches and provide an override reason.`);
        }
        throw new Error(body.message ?? "Create failed");
      }
      if (body.data) setStations((current) => [body.data as PoliceStationView, ...current]);
      setMessage(`Created ${String(payload.name)} (${body.data?.id ?? "new station"}).`);
      setMode("list");
      if (duplicates.length) setMessage(`Created with duplicate override after reviewing ${duplicates.length} possible matches.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Create failed");
      throw submitError;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={mode === "list" ? "primary" : "secondary"} onClick={() => setMode("list")}>Station list</Button>
        <Button variant={mode === "create" ? "primary" : "secondary"} onClick={() => setMode("create")}>Create station</Button>
        <Button variant="secondary" onClick={() => void refreshList()} disabled={loading}>{loading ? "Refreshing…" : "Refresh list"}</Button>
      </div>

      {mode === "create" ? (
        <PoliceStationForm
          title="Create police station"
          submitLabel={loading ? "Saving…" : "Create station"}
          disabled={loading}
          onSubmit={handleCreate}
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <FormField label="Search" htmlFor="police-search">
              <TextInput id="police-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or address" />
            </FormField>
            <FormField label="State" htmlFor="police-state">
              <TextInput id="police-state" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} placeholder="Lagos" />
            </FormField>
            <FormField label="LGA" htmlFor="police-lga">
              <TextInput id="police-lga" value={lgaFilter} onChange={(event) => setLgaFilter(event.target.value)} placeholder="Ikeja" />
            </FormField>
            <FormField label="Agency type" htmlFor="police-agency">
              <SelectInput id="police-agency" value={agencyFilter} onChange={(event) => setAgencyFilter(event.target.value)}>
                <option value="">All agency types</option>
                <option value="police">police</option>
                <option value="security">security</option>
              </SelectInput>
            </FormField>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-surfaceMuted text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length ? filtered.map((station) => (
                  <tr key={station.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{station.name}</p>
                      <p className="text-xs text-muted">{station.state} / {station.lga} · {station.stationType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={verificationTone(station.verificationStatus)}>{station.verificationStatus}</StatusBadge>
                      {!station.isActive ? <p className="mt-1 text-xs text-danger">Inactive</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <p>{station.officialPhone}</p>
                      <p className="text-xs text-muted">{station.emergencyPhone !== "-" ? station.emergencyPhone : "No emergency line"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{station.address}</td>
                    <td className="px-4 py-3">{station.latitude}, {station.longitude}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <Link className="font-semibold text-eye" href={`/police-stations/${station.id}`}>Manage</Link>
                        <a className="text-xs text-muted underline" href={station.navigationUrl} target="_blank" rel="noreferrer">Open map</a>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={6}>No police stations match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
    </div>
  );
}
