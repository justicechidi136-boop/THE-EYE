import { AppShell } from "../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../components/ui";
import { rolePermissions } from "../../lib/mock-data";

function modifyTone(value: string) {
  if (value === "No") return "danger";
  if (value === "Yes") return "success";
  return "info";
}

export default function RolesPage() {
  const restrictedRoles = rolePermissions.filter((role) => role.canModifyIncidents !== "Yes").length;

  return (
    <AppShell>
      <PageHeader eyebrow="Role-based access control" title="Roles and permissions" action={<StatusBadge tone="success">Jurisdiction scoped</StatusBadge>} />
      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Admin roles" value={`${rolePermissions.length}`} detail="Includes community moderation and oversight" />
        <MetricCard label="Restricted roles" value={`${restrictedRoles}`} detail="Limited incident modification access" />
        <MetricCard label="Audit coverage" value="Every action" detail="Admin and moderator actions are logged" />
      </section>

      <Panel title="Access matrix">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Incident access</th>
                <th className="px-4 py-3">Modify incidents</th>
                <th className="px-4 py-3">Community access</th>
                <th className="px-4 py-3">Audit access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rolePermissions.map((role) => (
                <tr key={role.role}>
                  <td className="px-4 py-3 font-semibold text-ink">{role.role}</td>
                  <td className="px-4 py-3 text-muted">{role.scope}</td>
                  <td className="px-4 py-3">{role.incidentAccess}</td>
                  <td className="px-4 py-3"><StatusBadge tone={modifyTone(role.canModifyIncidents)}>{role.canModifyIncidents}</StatusBadge></td>
                  <td className="px-4 py-3 text-muted">{role.communityAccess}</td>
                  <td className="px-4 py-3">{role.auditAccess}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Jurisdiction rules">
          <div className="grid gap-2 text-sm text-muted">
            <p>Super Admin sees all incidents and administrative records.</p>
            <p>Country, State, and LGA admins are constrained by assigned geography.</p>
            <p>Agency users see only incidents assigned to their agency.</p>
          </div>
        </Panel>
        <Panel title="Community moderation">
          <div className="grid gap-2 text-sm text-muted">
            <p>Community Moderator can approve members, verify posts, manage patrols, and escalate verified alerts.</p>
            <p>Private community content remains hidden unless membership is approved.</p>
          </div>
        </Panel>
        <Panel title="Oversight">
          <div className="grid gap-2 text-sm text-muted">
            <p>Oversight Auditor can view immutable audit logs and incident history.</p>
            <p>Closure, rejection, false-report marking, evidence access, and escalation actions require audit reasons.</p>
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
