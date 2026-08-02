"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import {
  ConsoleDataTable,
  ConsoleEmptyState,
  ConsoleFilterBar,
  ConsoleFilterSelect,
} from "../console";
import { CoordinatePanel, googleMapsUrl } from "./coordinate-panel";
import { Panel, StatusBadge } from "../ui";
import type { DispatchIncident, DispatchResponder } from "../../lib/api/dispatch";
import {
  incidentIsSilent,
  incidentSlaLabel,
  incidentSlaTone,
  priorityShort,
  priorityTone,
  secondsSinceSubmitted,
  workloadSummary,
} from "../../lib/dispatch/console-utils";
import { formatDuration } from "../../lib/dispatch/sla-display";

type CommandCentreConsoleProps = {
  queue: DispatchIncident[];
  responders: DispatchResponder[];
};

function CommandCentreConsoleInner({ queue, responders }: CommandCentreConsoleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("incident") ?? queue[0]?.id ?? "";
  const selected = queue.find((incident) => incident.id === selectedId) ?? queue[0] ?? null;
  const summary = useMemo(() => workloadSummary(queue, responders), [queue, responders]);

  const coordinateRows = queue.map((incident) => ({
    id: incident.id,
    label: `${priorityShort(incident.priority)} · ${incident.title}`,
    latitude: Number(incident.latitude),
    longitude: Number(incident.longitude),
    stale: incident.liveLocationStale,
    navigationUrl: googleMapsUrl(Number(incident.latitude), Number(incident.longitude)),
  }));

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Emergency queue</p>
          <strong className="mt-2 block text-2xl text-danger">{summary.unassigned}</strong>
        </article>
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Responding</p>
          <strong className="mt-2 block text-2xl text-ink">{summary.responding}</strong>
        </article>
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Available responders</p>
          <strong className="mt-2 block text-2xl text-eye">{summary.availableResponders}</strong>
        </article>
        <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Stale citizen locations</p>
          <strong className="mt-2 block text-2xl text-warning">{summary.stale}</strong>
        </article>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
        <ConsoleFilterBar>
          <ConsoleFilterSelect
            name="priority"
            label="Priority"
            options={[
              { value: "P1LifeThreatening", label: "P1" },
              { value: "P2ActiveCrimeAccident", label: "P2" },
              { value: "P3SuspiciousActivity", label: "P3" },
            ]}
          />
          <ConsoleFilterSelect
            name="type"
            label="Incident type"
            options={[
              { value: "Emergency", label: "Emergency" },
              { value: "SOS", label: "SOS" },
              { value: "Medical", label: "Medical" },
            ]}
          />
        </ConsoleFilterBar>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="grid min-w-0 gap-5">
          <Panel title="Emergency queue" aside={<StatusBadge tone="danger">{queue.length} unassigned</StatusBadge>}>
            {queue.length ? (
              <ConsoleDataTable
                columns={["Incident", "Priority", "Status", "SLA", "Location", ""]}
                rows={queue.map((incident) => [
                  <button
                    key={`select-${incident.id}`}
                    type="button"
                    className={`text-left ${selected?.id === incident.id ? "rounded-md ring-2 ring-accent/40" : ""}`}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("incident", incident.id);
                      router.push(`/dispatch?${params.toString()}`);
                    }}
                  >
                    <p className="font-semibold">{incident.title}</p>
                    <p className="text-xs text-muted">{incident.id}</p>
                    {incidentIsSilent(incident) ? <StatusBadge tone="warning">Silent SOS</StatusBadge> : null}
                  </button>,
                  <StatusBadge key={`priority-${incident.id}`} tone={priorityTone(incident.priority)}>{priorityShort(incident.priority)}</StatusBadge>,
                  incident.status,
                  <StatusBadge key={`sla-${incident.id}`} tone={incidentSlaTone(incident)}>{incidentSlaLabel(incident)}</StatusBadge>,
                  incident.liveLocationStale ? <StatusBadge tone="warning">Stale</StatusBadge> : "Fresh",
                  <Link key={`open-${incident.id}`} href={`/dispatch/incidents/${incident.id}`} className="text-sm font-semibold text-eye hover:underline">
                    Open
                  </Link>,
                ])}
              />
            ) : (
              <ConsoleEmptyState title="No unassigned incidents in scope" />
            )}
          </Panel>
          <Panel title="Map / coordinate panel">
            <CoordinatePanel rows={coordinateRows} title="Incident positions" />
          </Panel>
        </div>

        <div className="grid min-w-0 gap-5">
          <Panel title="Selected incident">
            {selected ? (
              <dl className="grid gap-2 text-sm">
                <div><dt className="text-muted">Title</dt><dd className="font-semibold">{selected.title}</dd></div>
                <div><dt className="text-muted">Type</dt><dd>{selected.type}</dd></div>
                <div><dt className="text-muted">Priority</dt><dd>{priorityShort(selected.priority)}</dd></div>
                <div><dt className="text-muted">Jurisdiction</dt><dd>{[selected.lga, selected.state, selected.country].filter(Boolean).join(", ")}</dd></div>
                <div><dt className="text-muted">Time since report</dt><dd>{secondsSinceSubmitted(selected) !== null ? formatDuration(secondsSinceSubmitted(selected)!) : "Unknown"}</dd></div>
                <div><dt className="text-muted">Communication status</dt><dd>Operational chat available via Live Chat when linked</dd></div>
                <div><dt className="text-muted">Live video</dt><dd>Unavailable until LiveKit admin viewer is configured</dd></div>
                <div className="pt-2">
                  <Link href={`/dispatch/incidents/${selected.id}`} className="text-sm font-semibold text-eye hover:underline">
                    Open full command detail
                  </Link>
                </div>
              </dl>
            ) : (
              <ConsoleEmptyState title="Select an incident from the queue" />
            )}
          </Panel>
          <Panel title="Responder roster">
            <ul className="grid gap-2">
              {responders.map((responder) => (
                <li key={responder.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{responder.displayName}</span>
                    <StatusBadge tone={responder.availability.toLowerCase().includes("available") ? "success" : "neutral"}>
                      {responder.availability}
                    </StatusBadge>
                  </div>
                </li>
              ))}
              {!responders.length ? <ConsoleEmptyState title="No responders in scope" /> : null}
            </ul>
          </Panel>
          <Panel title="Agency recommendations">
            <p className="text-sm text-muted">
              Recommendations load on incident detail after triage. Road ETA and embedded maps are unavailable; coordinates link to external navigation.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function CommandCentreConsole(props: CommandCentreConsoleProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading command centre…</p>}>
      <CommandCentreConsoleInner {...props} />
    </Suspense>
  );
}
