import Link from "next/link";
import { PolicySectionPanel } from "../../../components/settings/policy-section-panel";
import { ThemeSettingsPanel } from "../../../components/theme-settings-panel";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchPolicies } from "../../../lib/api/policies";
import { getAdminSession } from "../../../lib/session";
import { formatJurisdiction } from "../../../lib/admin-presentation";

export const dynamic = "force-dynamic";

const CONFIG_SECTIONS = [
  { id: "community", label: "Community Configuration", description: "Visibility, membership rules, and hierarchy defaults." },
  { id: "permissions", label: "Permissions", description: "Role assignments and moderator capabilities." },
  { id: "notifications", label: "Notification Rules", description: "Resident and volunteer alert policies." },
  { id: "broadcasts", label: "Broadcast Rules", description: "Emergency broadcast approval thresholds." },
  { id: "verification", label: "Verification Rules", description: "AI confidence gates and manual review triggers." },
  { id: "patrols", label: "Patrol Rules", description: "Patrol scheduling and checkpoint requirements." },
  { id: "volunteers", label: "Volunteer Rules", description: "Volunteer onboarding and availability." },
  { id: "smartwatch", label: "Smartwatch Settings", description: "Device pairing and SOS defaults." },
  { id: "integrations", label: "API Integrations", description: "External GIS, SMS, and webhook connectors." },
] as const;

const MANAGE_ROLES = new Set(["Super Admin", "Country Admin", "State Admin", "LGA Admin", "Community Moderator"]);

export default async function CsocSettingsPage() {
  const session = await getAdminSession();
  const policies = await fetchPolicies();
  const policyBySection = new Map(policies.map((policy) => [policy.section, policy]));
  const canManage = MANAGE_ROLES.has(session?.role ?? "");

  return (
    <>
      <PageHeader
        eyebrow="Neighborhood Watch configuration"
        title="Settings"
        action={<StatusBadge tone="success">Live policy sync</StatusBadge>}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Appearance">
          <ThemeSettingsPanel />
        </Panel>
        <Panel title="Session">
          <div className="grid gap-2 text-sm">
            <p><span className="font-semibold">Email:</span> {session?.email ?? "—"}</p>
            <p><span className="font-semibold">Role:</span> {session?.role ?? "—"}</p>
            <p><span className="font-semibold">Jurisdiction:</span> {formatJurisdiction([session?.country, session?.state, session?.lga], "—")}</p>
            <p><span className="font-semibold">Permissions:</span> {session?.permissions?.length ?? 0} granted</p>
          </div>
        </Panel>
      </div>
      <Panel title="Operational shortcuts">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/dispatch" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Emergency command center</Link>
          <Link href="/neighborhood-watch/verification" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Verification queue</Link>
          <Link href="/neighborhood-watch/chat" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Community chat</Link>
          <Link href="/settings" className="rounded-lg border border-line bg-surfaceMuted px-3 py-2 text-sm font-semibold transition-colors hover:border-eye">Platform settings</Link>
        </div>
      </Panel>
      <Panel title="Community policy configuration">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONFIG_SECTIONS.map((section) => (
            <Link
              key={section.id}
              href={`#csoc-settings-${section.id}`}
              className="rounded-lg border border-line bg-surfaceMuted px-4 py-3 transition-colors hover:border-eye"
            >
              <p className="text-sm font-semibold text-ink">{section.label}</p>
              <p className="mt-1 text-xs text-muted">{section.description}</p>
            </Link>
          ))}
        </div>
        <div className="grid gap-4">
          {CONFIG_SECTIONS.map((section) => (
            <PolicySectionPanel
              key={section.id}
              section={section.id}
              title={section.label}
              description={section.description}
              policy={policyBySection.get(section.id) ?? null}
              canManage={canManage}
              scope="jurisdiction"
              anchorId={`csoc-settings-${section.id}`}
            />
          ))}
        </div>
      </Panel>
    </>
  );
}
