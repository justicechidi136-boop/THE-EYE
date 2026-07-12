import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Button } from "../../components/form-primitives";
import { DuplicateReportPanel, VerificationStatusBadge, WitnessConfirmationPanel } from "../../components/verification-ui";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchVerificationQueue } from "../../lib/api/data";

const signals = ["GPS accuracy", "Reporter trust", "Media evidence", "Nearby duplicates", "Crowd confirmations", "False-report history"];

export const dynamic = "force-dynamic";

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export default async function VerificationPage() {
  const incidents = await fetchVerificationQueue();

  return (
    <AppShell>
      <PageHeader eyebrow="Confidence scoring" title="Incident verification queue" action={<StatusBadge tone="warning">1-5s target</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel title="Queue">
          <div className="grid gap-3">
            {incidents.length ? incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{incident.title}</p>
                    <p className="mt-1 text-sm text-muted">{incident.location}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <VerificationStatusBadge score={incident.confidenceScore} status={incident.status} />
                    <StatusBadge tone={incident.confidenceScore >= 85 ? "success" : incident.confidenceScore >= 70 ? "info" : "warning"}>
                      {incident.confidenceScore}% confidence
                    </StatusBadge>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <a href={mapsUrl(incident.gps.lat, incident.gps.lng)} target="_blank" rel="noreferrer" className="rounded-md bg-surfaceMuted px-3 py-2 text-sm font-semibold text-eye hover:underline">
                    GPS {incident.gps.accuracy}
                  </a>
                  <span className="rounded-md bg-surfaceMuted px-3 py-2 text-sm text-muted">{incident.evidence.length} evidence files</span>
                  <span className="rounded-md bg-surfaceMuted px-3 py-2 text-sm text-muted">{incident.reporterStatus}</span>
                </div>
                <div className="mt-4 grid gap-3">
                  <DuplicateReportPanel incidentId={incident.id} />
                  <WitnessConfirmationPanel incidentId={incident.id} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/incidents/${incident.id}`}><Button variant="secondary">Review incident</Button></Link>
                  <Button>Approve verification</Button>
                  <Button variant="danger">Mark false information</Button>
                </div>
              </div>
            )) : <p className="text-sm text-muted">No incidents are waiting in the verification queue.</p>}
          </div>
        </Panel>
        <Panel title="Scoring signals">
          <div className="grid gap-2">
            {signals.map((signal) => <div key={signal} className="rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">{signal}</div>)}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
