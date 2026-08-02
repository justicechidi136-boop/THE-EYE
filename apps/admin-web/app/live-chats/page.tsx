import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import {
  ConsoleDataTable,
  ConsoleEmptyState,
  ConsoleFilterBar,
  ConsoleFilterSelect,
  ConsoleMetrics,
  ConsolePageHeader,
  ConsolePagination,
  ConsoleSearchInput,
} from "../../components/console";
import { StatusBadge } from "../../components/ui";
import { fetchSupportChats } from "../../lib/api/data";
import { getRouteById } from "../../lib/admin/admin-route-registry";

export const dynamic = "force-dynamic";

function priorityTone(priority: string): "danger" | "warning" | "info" | "neutral" {
  if (priority === "Urgent") return "danger";
  if (priority === "High") return "warning";
  if (priority === "Normal") return "info";
  return "neutral";
}

export default async function LiveChatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const route = getRouteById("live-chat");
  const page = await fetchSupportChats({
    cursor: params.cursor,
    status: params.status,
    priority: params.priority,
    type: params.type,
    q: params.q,
  });

  const active = page.data.filter((chat) => chat.status === "Open" || chat.status === "Escalated").length;
  const unread = page.data.reduce((sum, chat) => sum + chat.unreadAdmin, 0);

  const nextHref = page.hasMore && page.nextCursor
    ? `/live-chats?${new URLSearchParams({ ...params, cursor: page.nextCursor }).toString()}`
    : undefined;

  return (
    <AppShell>
      <ConsolePageHeader
        title={route?.pageHeading ?? "Live operational chat"}
        eyebrow="Operational communications"
        breadcrumbs={route?.breadcrumb}
        action={<StatusBadge tone="info">{page.data.length} conversations</StatusBadge>}
      />
      <div className="grid gap-5">
        <ConsoleMetrics
          items={[
            { label: "Active conversations", value: String(active) },
            { label: "Unread for admins", value: String(unread) },
            { label: "Escalated", value: String(page.data.filter((chat) => chat.status === "Escalated").length) },
            { label: "Incident-linked", value: String(page.data.filter((chat) => chat.incidentId).length) },
          ]}
        />
        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={null}>
            <ConsoleFilterBar>
              <ConsoleSearchInput placeholder="Search subject or reference" defaultValue={params.q} />
              <ConsoleFilterSelect
                name="status"
                label="Status"
                defaultValue={params.status}
                options={[
                  { value: "Open", label: "Open" },
                  { value: "Pending", label: "Pending" },
                  { value: "Escalated", label: "Escalated" },
                  { value: "Closed", label: "Closed" },
                ]}
              />
              <ConsoleFilterSelect
                name="priority"
                label="Priority"
                defaultValue={params.priority}
                options={[
                  { value: "Urgent", label: "Urgent" },
                  { value: "High", label: "High" },
                  { value: "Normal", label: "Normal" },
                  { value: "Low", label: "Low" },
                ]}
              />
              <ConsoleFilterSelect
                name="type"
                label="Type"
                defaultValue={params.type}
                options={[
                  { value: "Incident", label: "Incident" },
                  { value: "CitizenSupport", label: "Citizen support" },
                  { value: "Agency", label: "Agency" },
                  { value: "Responder", label: "Responder" },
                ]}
              />
            </ConsoleFilterBar>
          </Suspense>
        </section>
        <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          {page.data.length ? (
            <>
              <ConsoleDataTable
                columns={["Conversation", "Type", "Priority", "Status", "Assignment", "Unread", ""]}
                rows={page.data.map((chat) => [
                  <div key={`subject-${chat.id}`}>
                    <p className="font-semibold">{chat.subject}</p>
                    <p className="text-xs text-muted">{chat.reference}</p>
                    {chat.incidentTitle ? <p className="mt-1 text-xs text-muted">Incident: {chat.incidentTitle}</p> : null}
                  </div>,
                  chat.type,
                  <StatusBadge key={`priority-${chat.id}`} tone={priorityTone(chat.priority)}>{chat.priority}</StatusBadge>,
                  chat.status,
                  chat.assignedAdminName ?? "Unassigned",
                  String(chat.unreadAdmin),
                  <Link key={`open-${chat.id}`} href={`/live-chats/${chat.id}`} className="text-sm font-semibold text-eye hover:underline">
                    Open
                  </Link>,
                ])}
              />
              <ConsolePagination hasMore={page.hasMore} nextHref={nextHref} />
            </>
          ) : (
            <ConsoleEmptyState
              title="No operational conversations yet"
              detail="Live Chat is separate from Community Chat moderation. Conversations appear here when citizens, responders, or agencies need operational follow-up."
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
