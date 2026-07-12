import { AppShell } from "../../components/app-shell";
import { ThemeSettingsPanel } from "../../components/theme-settings-panel";
import { PageHeader, Panel } from "../../components/ui";
import { getAdminSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getAdminSession();

  return (
    <AppShell>
      <PageHeader eyebrow="Account preferences" title="Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Profile">
          <div className="grid gap-3 text-sm">
            <p><span className="font-semibold">Email:</span> {session?.email ?? "Not signed in"}</p>
            <p><span className="font-semibold">Role:</span> {session?.role ?? "—"}</p>
            <p><span className="font-semibold">Jurisdiction:</span> {[session?.country, session?.state, session?.lga].filter(Boolean).join(" / ") || "—"}</p>
          </div>
        </Panel>
        <Panel title="Security">
          <div className="grid gap-2 text-sm text-muted">
            <p>Two-factor verification uses the Figma verify-login token flow.</p>
            <p>Password reset is available from the forgot-password screens.</p>
          </div>
        </Panel>
        <Panel title="Notifications">
          <div className="grid gap-2 text-sm text-muted">
            <p>Critical incident alerts: enabled</p>
            <p>Broadcast approval requests: enabled</p>
            <p>Live video session alerts: enabled</p>
          </div>
        </Panel>
        <Panel title="Display">
          <ThemeSettingsPanel />
        </Panel>
      </div>
    </AppShell>
  );
}
