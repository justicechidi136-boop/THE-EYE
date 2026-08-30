import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { ConsoleDataTable, ConsoleMetrics, ConsolePageHeader } from "../../components/console";
import { UserDirectoryFilters } from "../../components/users/user-directory-filters";
import { StatusBadge } from "../../components/ui";
import { fetchUserDirectoryOptions, fetchUsersDirectoryPage } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";
import { encodeCursorHistory, parseCursorHistory } from "../../lib/report-centre-presentation";

export const dynamic = "force-dynamic";

function pageHref(params: Record<string, string | undefined>, cursor: string | undefined, history: string[]) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "cursor" && key !== "history") next.set(key, value);
  }
  if (cursor) next.set("cursor", cursor);
  if (history.length) next.set("history", encodeCursorHistory(history));
  return `/users${next.size ? `?${next.toString()}` : ""}`;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const route = getRouteById("users");
  const [page, directoryOptions] = await Promise.all([
    fetchUsersDirectoryPage({
      cursor: params.cursor,
      q: params.q,
      status: params.status,
      kind: params.kind,
      country: params.country,
      state: params.state,
      lga: params.lga,
      communityId: params.communityId,
      limit: "10",
    }),
    fetchUserDirectoryOptions(),
  ]);
  const history = parseCursorHistory(params.history);
  const currentPage = history.length + 1;
  const previousEntry = history.at(-1);
  const previousHref = previousEntry
    ? pageHref(params, previousEntry === "first" ? undefined : previousEntry, history.slice(0, -1))
    : undefined;
  const nextHref = page.hasMore && page.nextCursor
    ? pageHref(params, page.nextCursor, [...history, params.cursor ?? "first"])
    : undefined;
  const knownStarts: Array<string | undefined> = [undefined, ...history.slice(1), ...(params.cursor ? [params.cursor] : [])];
  const visiblePages = Array.from({ length: currentPage + (nextHref ? 1 : 0) }, (_, index) => index + 1);

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "User management"}
        eyebrow="Identity and access workspace"
        breadcrumbs={route?.breadcrumb}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/users/kyc" className="text-sm font-semibold text-eye hover:underline">KYC queue</Link>
            <Link href="/users/new" className="rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white hover:bg-eyeDeep">Create account</Link>
          </div>
        }
      />
      <div className="grid gap-5">
        <ConsoleMetrics items={[
          { label: "Total Users", value: String(page.meta.totalUsers) },
          { label: "Active Users", value: String(page.meta.activeUsers) },
          { label: "Pending Users", value: String(page.meta.pendingUsers) },
          { label: "Deactivated Users", value: String(page.meta.deactivatedUsers) },
        ]} />

        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <UserDirectoryFilters options={directoryOptions} />
        </section>

        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <ConsoleDataTable
            columns={["User", "Role", "Account status", "Jurisdiction", "Action"]}
            rows={page.data.map((user) => [
              <div key={`name-${user.id}`} className="min-w-0">
                <p className="truncate font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.id}</p>
              </div>,
              <span key={`role-${user.id}`} className="break-words">{user.role}</span>,
              <StatusBadge key={`status-${user.id}`} tone={user.status === "Active" ? "success" : user.status === "Deactivated" ? "danger" : "warning"}>{user.status}</StatusBadge>,
              <span key={`scope-${user.id}`} className="line-clamp-2 break-words">{user.scope || "None / Not assigned"}</span>,
              <Link key={`open-${user.id}`} href={`/users/${user.id}`} className="text-sm font-semibold text-eye hover:underline">Open</Link>,
            ])}
            emptyMessage="No users match the current search and filters."
          />

          <nav className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-line pt-4" aria-label="User directory pages">
            {previousHref ? <Link href={previousHref} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-eye">Previous</Link> : <span aria-disabled="true" className="cursor-not-allowed rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted opacity-50">Previous</span>}
            {visiblePages.map((number) => {
              if (number === currentPage) return <span key={number} aria-current="page" className="grid h-10 min-w-10 place-items-center rounded-md bg-eye px-3 text-sm font-semibold text-white">{number}</span>;
              if (number === currentPage + 1 && nextHref) return <Link key={number} href={nextHref} className="grid h-10 min-w-10 place-items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-eye">{number}</Link>;
              const cursor = number === 1 ? undefined : knownStarts[number - 1];
              const targetHistory = number === 1 ? [] : ["first", ...knownStarts.slice(1, number - 1).filter((entry): entry is string => Boolean(entry))];
              return <Link key={number} href={pageHref(params, cursor, targetHistory)} className="grid h-10 min-w-10 place-items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:border-eye">{number}</Link>;
            })}
            {nextHref ? <Link href={nextHref} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-eye">Next</Link> : <span aria-disabled="true" className="cursor-not-allowed rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted opacity-50">Next</span>}
          </nav>
        </section>
      </div>
    </AppShell>
  );
}
