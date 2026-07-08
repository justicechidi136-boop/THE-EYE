import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";

const jurisdictions = [
  { name: "Nigeria", level: "Country", admins: 2, incidentAccess: "All Nigerian states" },
  { name: "Lagos", level: "State", admins: 4, incidentAccess: "Lagos State only" },
  { name: "Ikeja", level: "LGA", admins: 6, incidentAccess: "Ikeja LGA only" },
];

export default function JurisdictionsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="RBAC boundaries" title="Jurisdiction management" action={<StatusBadge tone="success">Scoped access enforced</StatusBadge>} />
      <Panel title="Jurisdiction tree">
        <div className="grid gap-3">
          {jurisdictions.map((jurisdiction) => (
            <div key={jurisdiction.name} className="grid gap-2 rounded-lg border border-line bg-slate-50 p-4 md:grid-cols-[1fr_160px_160px] md:items-center">
              <div>
                <p className="font-semibold">{jurisdiction.name}</p>
                <p className="mt-1 text-sm text-muted">{jurisdiction.incidentAccess}</p>
              </div>
              <StatusBadge tone="info">{jurisdiction.level}</StatusBadge>
              <p className="text-sm text-muted">{jurisdiction.admins} assigned admins</p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
