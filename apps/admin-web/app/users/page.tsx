import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { ConsoleDataTable, ConsoleMetrics, ConsolePageHeader, ConsolePagination } from "../../components/console";
import { UserDirectoryFilters } from "../../components/users/user-directory-filters";
import { StatusBadge } from "../../components/ui";
import { fetchUserDirectoryOptions, fetchUsersDirectoryPage } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";
import { reportPaginationItems } from "../../lib/report-centre-presentation";

export const dynamic = "force-dynamic";

function pageHref(params: Record<string, string | undefined>, page: number, limit: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && !["cursor", "history", "page", "limit"].includes(key)) next.set(key, value);
  }
  next.set("page", String(page));
  next.set("limit", String(limit));
  return `/users${next.size ? `?${next.toString()}` : ""}`;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const route = getRouteById("users");
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLimit = Number.parseInt(params.limit ?? "20", 10);
  const pageSize = [20, 50, 100].includes(requestedLimit) ? requestedLimit : 20;
  const [page, directoryOptions] = await Promise.all([
    fetchUsersDirectoryPage({
      page: String(currentPage),
      q: params.q,
      status: params.status,
      kind: params.kind,
      country: params.country,
      state: params.state,
      lga: params.lga,
      cityId: params.cityId,
      communityId: params.communityId,
      limit: String(pageSize),
    }),
    fetchUserDirectoryOptions(),
  ]);
  const totalPages = page.pagination.pageCount;
  const previousHref = currentPage > 1 ? pageHref(params, currentPage - 1, pageSize) : undefined;
  const nextHref = currentPage < totalPages ? pageHref(params, currentPage + 1, pageSize) : undefined;
  const pageLinks = reportPaginationItems(currentPage, totalPages).map((item) => item === "ellipsis"
    ? { label: "…" }
    : { label: String(item), href: pageHref(params, item, pageSize), current: item === currentPage });
  const pageSizeLinks = [20, 50, 100].map((size) => ({ size, href: pageHref(params, 1, size), current: size === pageSize }));

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
              <span key={`scope-${user.id}`} className="line-clamp-2 break-words">{user.scope || "Not assigned"}</span>,
              <Link key={`open-${user.id}`} href={`/users/${user.id}`} className="text-sm font-semibold text-eye hover:underline">Open</Link>,
            ])}
            emptyMessage="No users match the current search and filters."
          />

          <ConsolePagination currentPage={currentPage} totalItems={page.pagination.total} pageSize={pageSize} previousHref={previousHref} nextHref={nextHref} pageLinks={pageLinks} pageSizeLinks={pageSizeLinks} />
        </section>
      </div>
    </AppShell>
  );
}
