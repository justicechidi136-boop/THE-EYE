import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import {
  ConsoleDataTable,
  ConsoleFilterBar,
  ConsoleFilterSelect,
  ConsoleMetrics,
  ConsolePageHeader,
  ConsolePagination,
  ConsoleSearchInput,
  ConsoleViewSwitcher,
} from "../../components/console";
import { StatusBadge } from "../../components/ui";
import { fetchUsersDirectoryPage } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const route = getRouteById("users");
  const view = params.view ?? "table";
  const page = await fetchUsersDirectoryPage({
    cursor: params.cursor,
    q: params.q,
    searchType: params.searchType,
    searchBy: params.searchBy,
    status: params.status,
    role: params.role,
    kind: params.kind,
  });

  const nextHref = page.hasMore && page.nextCursor
    ? `/users?${new URLSearchParams({ ...params, cursor: page.nextCursor }).toString()}`
    : undefined;

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "User management"}
        eyebrow="Identity and access workspace"
        breadcrumbs={route?.breadcrumb}
        action={
          <div className="flex items-center gap-3">
            <Link href="/users/kyc" className="text-sm text-accent underline">
              KYC queue
            </Link>
            <Link href="/users/new" className="rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white hover:bg-eyeDeep">
              Create account
            </Link>
            <StatusBadge tone="success">{page.data.length} loaded</StatusBadge>
          </div>
        }
      />
      <div className="grid gap-5">
        <ConsoleMetrics
          items={[
            { label: "Loaded users", value: String(page.data.length) },
            { label: "Active", value: String(page.data.filter((user) => user.status === "Active").length) },
            { label: "Admins in page", value: String(page.data.filter((user) => user.role.includes("Admin")).length) },
            { label: "More pages", value: page.hasMore ? "Available" : "End" },
          ]}
        />
        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={null}>
            <div className="grid gap-4">
              <ConsoleViewSwitcher
                options={[
                  { value: "table", label: "Detailed table" },
                  { value: "compact", label: "Compact table" },
                  { value: "cards", label: "Cards" },
                  { value: "role", label: "Role view" },
                ]}
              />
              <ConsoleFilterBar>
                <ConsoleSearchInput label="Search user" placeholder="Name, email, phone, or ID" defaultValue={params.q} />
                <ConsoleFilterSelect
                  name="searchType"
                  label="Search type"
                  defaultValue={params.searchType ?? "contains"}
                  options={[
                    { value: "exact", label: "Exact" },
                    { value: "contains", label: "Contains" },
                    { value: "startsWith", label: "Starts with" },
                    { value: "advanced", label: "Advanced" },
                  ]}
                />
                <ConsoleFilterSelect
                  name="searchBy"
                  label="Search by"
                  defaultValue={params.searchBy ?? "name"}
                  options={[
                    { value: "name", label: "Name" },
                    { value: "email", label: "Email" },
                    { value: "phone", label: "Phone" },
                    { value: "userId", label: "User ID" },
                    { value: "role", label: "Role" },
                  ]}
                />
                <ConsoleFilterSelect
                  name="status"
                  label="Account status"
                  defaultValue={params.status}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "suspended", label: "Suspended" },
                    { value: "locked", label: "Locked" },
                  ]}
                />
                <ConsoleFilterSelect
                  name="kind"
                  label="Account kind"
                  defaultValue={params.kind}
                  options={[
                    { value: "admin", label: "Admin" },
                    { value: "citizen", label: "Citizen" },
                  ]}
                />
              </ConsoleFilterBar>
            </div>
          </Suspense>
        </section>
        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          {view === "cards" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {page.data.map((user) => (
                <Link key={user.id} href={`/users/${user.id}`} className="rounded-lg border border-line bg-surfaceMuted p-4 transition hover:border-accent">
                  <p className="font-semibold">{user.name}</p>
                  <p className="mt-1 text-sm text-muted">{user.role}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge tone="info">{user.status}</StatusBadge>
                    <StatusBadge>{user.scope}</StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <ConsoleDataTable
              columns={view === "compact" ? ["User", "Role", ""] : ["User", "Role", "Status", "Scope", ""]}
              rows={page.data.map((user) => {
                const base = [
                  <div key={`name-${user.id}`}>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-muted">{user.id}</p>
                  </div>,
                  user.role,
                ];
                if (view === "compact") {
                  return [...base, <Link key={`open-${user.id}`} href={`/users/${user.id}`} className="text-sm font-semibold text-eye hover:underline">Open</Link>];
                }
                return [
                  ...base,
                  user.status,
                  user.scope,
                  <Link key={`open-${user.id}`} href={`/users/${user.id}`} className="text-sm font-semibold text-eye hover:underline">Open</Link>,
                ];
              })}
              emptyMessage="No users returned for the current admin scope."
            />
          )}
          <ConsolePagination hasMore={page.hasMore} nextHref={nextHref} />
        </section>
      </div>
    </AppShell>
  );
}
