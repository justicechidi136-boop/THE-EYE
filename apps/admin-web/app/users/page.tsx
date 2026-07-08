import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { users } from "../../lib/mock-data";

export default function UsersPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Identity and access" title="User management" action={<StatusBadge tone="success">KYC aware</StatusBadge>} />
      <Panel title="Users and admins">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <div key={user.name} className="rounded-lg border border-line bg-slate-50 p-4">
              <p className="font-semibold">{user.name}</p>
              <p className="mt-1 text-sm text-muted">{user.role}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone="info">{user.status}</StatusBadge>
                <StatusBadge>{user.scope}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
