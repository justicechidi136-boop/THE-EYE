"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FormField, InlineAlert, TextInput } from "../form-primitives";
import { Panel } from "../ui";

type CommunityFormValues = {
  name: string;
  level: string;
  visibility: string;
  country: string;
  state: string;
  lga: string;
  ward: string;
  estate: string;
  street: string;
  description: string;
  latitude: string;
  longitude: string;
  boundaryWkt: string;
  status?: string;
};

type CommunityFormConsoleProps = {
  mode: "create" | "edit";
  communityId?: string;
  initial: CommunityFormValues;
  boundaryWkt?: string | null;
  areaSqM?: number | null;
};

export function CommunityFormConsole({
  mode,
  communityId,
  initial,
  boundaryWkt,
  areaSqM,
}: CommunityFormConsoleProps) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportedWkt, setExportedWkt] = useState(boundaryWkt ?? "");

  function updateField(field: keyof CommunityFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function exportBoundary() {
    if (!communityId) return;
    setError(null);
    try {
      const response = await fetch(`/api/admin/neighborhood-watch/communities/${communityId}/boundary`);
      const payload = (await response.json()) as { data?: { wkt?: string | null; areaSqM?: number | null }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Boundary export failed");
      const wkt = payload.data?.wkt ?? "";
      setExportedWkt(wkt);
      updateField("boundaryWkt", wkt);
      setMessage(wkt ? "Boundary exported from database." : "No boundary stored for this community.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Boundary export failed");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const payload = {
      name: form.name.trim(),
      level: form.level,
      visibility: form.visibility,
      country: form.country.trim(),
      state: form.state.trim() || undefined,
      lga: form.lga.trim() || undefined,
      ward: form.ward.trim() || undefined,
      estate: form.estate.trim() || undefined,
      street: form.street.trim() || undefined,
      description: form.description.trim() || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      boundaryWkt: form.boundaryWkt.trim() || undefined,
      ...(mode === "edit" && form.status ? { status: form.status } : {}),
    };

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/admin/neighborhood-watch/communities"
          : `/api/admin/neighborhood-watch/communities/${communityId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as { data?: { id?: string }; message?: string };
      if (!response.ok) throw new Error(result.message ?? "Save failed");
      setMessage(mode === "create" ? "Community created." : "Community updated.");
      const targetId = communityId ?? result.data?.id;
      if (targetId) router.push(`/neighborhood-watch/communities/${targetId}`);
      else router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <Panel title={mode === "create" ? "Create community" : "Edit community"}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Name">
            <TextInput value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
          </FormField>
          <FormField label="Level">
            <select className="h-11 w-full rounded-md border border-line bg-surface px-3 py-2" value={form.level} onChange={(event) => updateField("level", event.target.value)}>
              {["Country", "State", "LGA", "Ward", "Community", "Estate", "Street"].map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Visibility">
            <select className="h-11 w-full rounded-md border border-line bg-surface px-3 py-2" value={form.visibility} onChange={(event) => updateField("visibility", event.target.value)}>
              <option value="Public">Public</option>
              <option value="Private">Private</option>
            </select>
          </FormField>
          {mode === "edit" ? (
            <FormField label="Status">
              <select className="h-11 w-full rounded-md border border-line bg-surface px-3 py-2" value={form.status ?? "Active"} onChange={(event) => updateField("status", event.target.value)}>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Archived">Archived</option>
              </select>
            </FormField>
          ) : null}
          <FormField label="Country">
            <TextInput value={form.country} onChange={(event) => updateField("country", event.target.value)} required />
          </FormField>
          <FormField label="State">
            <TextInput value={form.state} onChange={(event) => updateField("state", event.target.value)} />
          </FormField>
          <FormField label="LGA">
            <TextInput value={form.lga} onChange={(event) => updateField("lga", event.target.value)} />
          </FormField>
          <FormField label="Ward">
            <TextInput value={form.ward} onChange={(event) => updateField("ward", event.target.value)} />
          </FormField>
          <FormField label="Estate">
            <TextInput value={form.estate} onChange={(event) => updateField("estate", event.target.value)} />
          </FormField>
          <FormField label="Street">
            <TextInput value={form.street} onChange={(event) => updateField("street", event.target.value)} />
          </FormField>
          <FormField label="Latitude">
            <TextInput value={form.latitude} onChange={(event) => updateField("latitude", event.target.value)} />
          </FormField>
          <FormField label="Longitude">
            <TextInput value={form.longitude} onChange={(event) => updateField("longitude", event.target.value)} />
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="Description">
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={3}
            />
          </FormField>
        </div>
      </Panel>
      <Panel
        title="Boundary WKT"
        aside={
          mode === "edit" ? (
            <button type="button" className="text-sm font-semibold text-eye hover:underline" onClick={exportBoundary}>
              Export stored boundary
            </button>
          ) : null
        }
      >
        {areaSqM ? <p className="mb-3 text-xs text-muted">Stored area: {Math.round(areaSqM).toLocaleString()} m²</p> : null}
        {exportedWkt && !form.boundaryWkt ? (
          <p className="mb-3 text-xs text-muted">Exported WKT available — paste into the field below to keep or replace.</p>
        ) : null}
        <FormField label="WKT (MULTIPOLYGON or POLYGON)" hint="Use import/export for community boundaries">
          <textarea
            className="min-h-40 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs"
            value={form.boundaryWkt}
            onChange={(event) => updateField("boundaryWkt", event.target.value)}
            placeholder="MULTIPOLYGON(((...)))"
          />
        </FormField>
      </Panel>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : mode === "create" ? "Create community" : "Save changes"}</Button>
        <Link href={communityId ? `/neighborhood-watch/communities/${communityId}` : "/neighborhood-watch/communities"} className="rounded-md border border-line px-4 py-2 text-sm font-semibold">
          Cancel
        </Link>
      </div>
    </form>
  );
}
