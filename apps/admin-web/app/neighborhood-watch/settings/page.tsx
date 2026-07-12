import { ThemeSettingsPanel } from "../../../components/theme-settings-panel";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { getAdminSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

const CONFIG_SECTIONS = [
  "Community Configuration",
  "Permissions",
  "Notification Rules",
  "Broadcast Rules",
  "Verification Rules",
  "Patrol Rules",
  "Volunteer Rules",
  "Smartwatch Settings",
  "API Integrations",
];

export default async function CsocSettingsPage() {
  const session = await getAdminSession();

  return (
    <>
      <PageHeader
        eyebrow="CSOC configuration"
        title="Settings"
        action={<StatusBadge tone="info">{session?.role ?? "Admin"}</StatusBadge>}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Appearance">
          <ThemeSettingsPanel />
        </Panel>
        <Panel title="Session">
          <div className="grid gap-2 text-sm">
            <p><span className="font-semibold">Email:</span> {session?.email ?? "—"}</p>
            <p><span className="font-semibold">Role:</span> {session?.role ?? "—"}</p>
            <p><span className="font-semibold">Jurisdiction:</span> {[session?.country, session?.state, session?.lga].filter(Boolean).join(" / ") || "—"}</p>
            <p><span className="font-semibold">Permissions:</span> {session?.permissions?.length ?? 0} granted</p>
          </div>
        </Panel>
      </div>
      <Panel title="Community configuration sections">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONFIG_SECTIONS.map((section) => (
            <span key={section} className="rounded-lg border border-line bg-surfaceMuted px-4 py-3 text-sm font-semibold">{section}</span>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Rule configuration panels connect to backend policy endpoints as they become available. Theme and session settings are live.</p>
      </Panel>
    </>
  );
}
