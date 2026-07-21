import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { fetchUsersDirectory } from "../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await fetchUsersDirectory();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Identity and access"
        title="User management"
        action={
          <div className="flex items-center gap-3">
            <Link href="/users/kyc" className="text-sm text-accent underline">
              KYC queue
            </Link>
            <StatusBadge tone="success">KYC aware</StatusBadge>
          </div>
        }
      />
      <Panel title="Users and admins">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.length ? (
            users.map((user) => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="rounded-lg border border-line bg-surfaceMuted p-4 transition hover:border-accent"
              >
                <p className="font-semibold">{user.name}</p>
                <p className="mt-1 text-sm text-muted">{user.role}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge tone="info">{user.status}</StatusBadge>
                  <StatusBadge>{user.scope}</StatusBadge>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted">No users returned for the current admin scope.</p>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
