import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { UserAccountActions } from "../../../components/users/user-account-actions";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchDirectoryDetail } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };
type Row = Record<string, unknown>;

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

function text(value: unknown, fallback = "Not provided") {
  return value === null || value === undefined || String(value).trim() === "" ? fallback : String(value);
}

function humanize(value: unknown, fallback = "Not provided") {
  const normalized = text(value, fallback).replaceAll("_", " ").replaceAll(".", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function date(value: unknown) {
  if (!value) return "Not available";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "Not available" : dateFormatter.format(parsed);
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object") : [];
}

function toneForStatus(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const normalized = status.toLowerCase();
  if (["active", "verified", "published", "resolved", "approved"].includes(normalized)) return "success";
  if (["suspended", "pending", "submitted", "verifying"].includes(normalized)) return "warning";
  if (["deactivated", "rejected", "closed", "false report"].includes(normalized)) return "danger";
  return "neutral";
}

function DetailList({ items }: { items: Array<[string, unknown, string?]> }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([label, value, fallback]) => (
        <div key={label} className="min-w-0 border-b border-line/70 pb-3">
          <dt className="text-xs font-medium uppercase text-muted">{label}</dt>
          <dd className="mt-1 break-words text-ink">{text(value, fallback)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-3 text-sm text-muted">{children}</p>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchDirectoryDetail(id);
  if (!detail) notFound();

  const kind = detail.typ === "admin" ? "admin" : "citizen";
  const profile = (detail.profile as Row | null) ?? null;
  const community = (profile?.community as Row | null) ?? null;
  const fullName = kind === "admin"
    ? text(detail.displayName, "Administrator")
    : text([profile?.firstName, profile?.lastName].filter(Boolean).join(" "), text(detail.email, "Citizen"));
  const status = text(detail.status, "Not available");
  const role = humanize(detail.role, kind === "admin" ? "Operational account" : "Citizen");
  const reports = rows(detail.reports);
  const broadcasts = rows(detail.broadcasts);
  const sightings = rows(detail.sightings);
  const activity = rows(detail.activity);
  const contacts = rows(detail.emergencyContacts);
  const kycHistory = rows(detail.kycHistory);
  const auditHistory = rows(detail.auditHistory);
  const sectionLinks = kind === "admin"
    ? [["Overview", "overview"], ["History", "history"]]
    : [["Overview", "overview"], ["Activity", "activity"], ["Reports", "reports"], ["Broadcasts", "broadcasts"], ["Sightings", "sightings"], ["History", "history"]];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Administration / Users / Account"
        title="User Details"
        action={<Link href="/users" className="text-sm font-semibold text-accent underline">Back to Users</Link>}
      />

      <section className="mb-4 border-y border-line bg-surface px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {profile?.avatarUrl ? (
              <img src={String(profile.avatarUrl)} alt={`${fullName} profile`} className="h-16 w-16 shrink-0 rounded-full border border-line object-cover" />
            ) : (
              <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-eye text-xl font-bold text-white">
                {fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U"}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-semibold text-ink">{fullName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={toneForStatus(status)}>{status}</StatusBadge>
                <span className="text-sm text-muted">{role}</span>
              </div>
              <p className="mt-2 break-all text-xs text-muted">User ID: {text(detail.id, "Not available")}</p>
            </div>
          </div>
          {detail.canManageStatus === false ? (
            <p className="text-sm text-muted">No account actions are available for your own account.</p>
          ) : <UserAccountActions id={id} kind={kind} status={status} />}
        </div>
      </section>

      <nav aria-label="User details sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-line pb-2 text-sm">
        {sectionLinks.map(([label, anchor]) => (
          <a key={anchor} href={`#${anchor}`} className="whitespace-nowrap rounded-md px-3 py-2 font-medium text-muted hover:bg-surfaceMuted hover:text-ink">{label}</a>
        ))}
      </nav>

      <div id="overview" className="grid gap-4 lg:grid-cols-2">
        <Panel title="Account overview">
          <DetailList items={[
            ["Full name", fullName], ["Email", detail.email], ["Phone", detail.phone],
            ["User ID", detail.id, "Not available"], ["Role / account type", role],
            ["Account status", status],
            ["Profile completion", kind === "citizen" ? (detail.profileComplete ? "Complete" : "Incomplete") : "Not applicable"],
            ["Trust score", detail.trustScore, "Not available"],
            ["Registered", date(detail.createdAt), "Not available"], ["Last active", date(detail.lastActiveAt), "Not available"],
          ]} />
        </Panel>

        <Panel title="Jurisdiction and scope">
          {kind === "admin" ? (
            <DetailList items={[["Jurisdiction / scope", detail.scope, "None / Not assigned"], ["Agency", detail.agency, "None / Not assigned"]]} />
          ) : (
            <DetailList items={[
              ["Country", profile?.country, "None / Not assigned"], ["State", profile?.state, "None / Not assigned"],
              ["LGA / City", profile?.lga, "None / Not assigned"], ["Community", community?.name, "None / Not assigned"],
              ["Address", profile?.address], ["Preferred language", profile?.effectivePreferredLocale ?? profile?.preferredLocale, "Not available"],
            ]} />
          )}
        </Panel>

        {kind === "citizen" ? (
          <>
            <Panel title="KYC history">
              <p className="mb-3 text-sm text-muted">Current status: <StatusBadge tone={toneForStatus(text(detail.kycStatus, "Unverified"))}>{text(detail.kycStatus, "Unverified")}</StatusBadge></p>
              {kycHistory.length ? <div className="divide-y divide-line">{kycHistory.map((row) => (
                <article key={text(row.id)} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-ink">{text(row.documentType, "Document")}</strong><StatusBadge tone={toneForStatus(text(row.status))}>{text(row.status)}</StatusBadge></div>
                  <p className="mt-2 text-muted">Submitted: {date(row.createdAt)}</p><p className="text-muted">Verified/reviewed: {date(row.reviewedAt)}</p>
                  {row.rejectionReason ? <p className="mt-1 text-danger">Reason: {text(row.rejectionReason)}</p> : null}
                </article>
              ))}</div> : <Empty>No KYC submissions</Empty>}
            </Panel>

            <Panel title="Emergency contacts">
              {contacts.length ? <div className="divide-y divide-line">{contacts.map((contact) => (
                <article key={text(contact.id)} className="py-3 text-sm"><strong className="text-ink">{text(contact.name)}</strong><p className="mt-1 text-muted">{text(contact.relationship)} · {text(contact.phone)}</p></article>
              ))}</div> : <Empty>No emergency contacts added.</Empty>}
            </Panel>
          </>
        ) : null}
      </div>

      {kind === "citizen" ? (
        <div className="mt-4 grid gap-4">
          <Panel title="Activity feed">
            <div id="activity">{activity.length ? activity.map((item) => (
              <article key={text(item.id)} className="flex flex-col gap-1 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium text-ink">{text(item.category)} · {text(item.label)}</p><p className="text-sm text-muted">{text(item.detail)}{item.location ? ` · ${text(item.location)}` : ""}</p></div>
                <span className="text-xs text-muted">{date(item.createdAt)}</span>
              </article>
            )) : <Empty>No community or verification activity available.</Empty>}</div>
          </Panel>

          <Panel title="Reports">
            <div id="reports" className="overflow-x-auto">{reports.length ? (
              <table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs uppercase text-muted"><tr><th className="py-2 pr-4">Report</th><th className="pr-4">Type</th><th className="pr-4">Priority</th><th className="pr-4">Status</th><th className="pr-4">Location</th><th className="pr-4">Captured</th><th>Action</th></tr></thead>
                <tbody className="divide-y divide-line">{reports.map((report) => <tr key={text(report.id)}><td className="py-3 pr-4 font-medium text-ink">{text(report.reference)}</td><td className="pr-4">{text(report.type)}</td><td className="pr-4">{text(report.priority)}</td><td className="pr-4"><StatusBadge tone={toneForStatus(text(report.status))}>{text(report.status)}</StatusBadge></td><td className="max-w-56 truncate pr-4">{text(report.location, "Not available")}</td><td className="whitespace-nowrap pr-4">{date(report.capturedAt)}</td><td><Link href={`/incidents/${encodeURIComponent(text(report.id))}`} className="font-semibold text-accent underline">Open</Link></td></tr>)}</tbody>
              </table>
            ) : <Empty>No reports submitted.</Empty>}</div>
          </Panel>

          <Panel title="Broadcasts">
            <div id="broadcasts" className="overflow-x-auto">{broadcasts.length ? (
              <table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-muted"><tr><th className="py-2 pr-4">Broadcast</th><th className="pr-4">Type</th><th className="pr-4">Title</th><th className="pr-4">Status</th><th className="pr-4">Target / scope</th><th className="pr-4">Created / published</th><th>Action</th></tr></thead>
                <tbody className="divide-y divide-line">{broadcasts.map((broadcast) => <tr key={text(broadcast.id)}><td className="py-3 pr-4 font-medium text-ink">{text(broadcast.reference)}</td><td className="pr-4">{text(broadcast.type)}</td><td className="max-w-56 truncate pr-4">{text(broadcast.title)}</td><td className="pr-4"><StatusBadge tone={toneForStatus(text(broadcast.status))}>{text(broadcast.status)}</StatusBadge></td><td className="pr-4">{text(broadcast.scope, "Nationwide")}</td><td className="whitespace-nowrap pr-4">{date(broadcast.publishedAt ?? broadcast.createdAt)}</td><td><Link href={`/broadcasts/${encodeURIComponent(text(broadcast.id))}`} className="font-semibold text-accent underline">Open</Link></td></tr>)}</tbody>
              </table>
            ) : <Empty>No broadcasts created.</Empty>}</div>
          </Panel>

          <Panel title="Sightings">
            <div id="sightings" className="overflow-x-auto">{sightings.length ? (
              <table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-muted"><tr><th className="py-2 pr-4">Reference</th><th className="pr-4">Related broadcast</th><th className="pr-4">Type</th><th className="pr-4">Location</th><th className="pr-4">Reported</th><th className="pr-4">Review</th><th>Action</th></tr></thead>
                <tbody className="divide-y divide-line">{sightings.map((sighting) => <tr key={text(sighting.id)}><td className="py-3 pr-4 font-medium text-ink">{text(sighting.reference)}</td><td className="max-w-56 truncate pr-4">{text(sighting.relatedBroadcast)}</td><td className="pr-4">{text(sighting.type)}</td><td className="pr-4">{text(sighting.location, "Not available")}</td><td className="whitespace-nowrap pr-4">{date(sighting.reportedAt)}</td><td className="pr-4">{text(sighting.reviewStatus)}</td><td><Link href={`/broadcasts/${encodeURIComponent(text(sighting.broadcastId))}/sightings/${encodeURIComponent(text(sighting.id))}`} className="font-semibold text-accent underline">Review</Link></td></tr>)}</tbody>
              </table>
            ) : <Empty>No sightings reported.</Empty>}</div>
          </Panel>
        </div>
      ) : null}

      <div id="history" className="mt-4"><Panel title="Account history">
        {auditHistory.length ? <div className="divide-y divide-line">{auditHistory.map((entry) => (
          <article key={text(entry.id)} className="grid gap-2 py-3 text-sm md:grid-cols-[minmax(0,1fr)_180px]">
            <div><p className="font-medium text-ink">{humanize(entry.event)}</p><p className="mt-1 text-muted">Actor: {text(entry.actor, "System")}</p>{entry.reason ? <p className="mt-1 text-muted">Reason: {text(entry.reason)}</p> : null}{entry.beforeStatus || entry.afterStatus ? <p className="mt-1 text-muted">{text(entry.beforeStatus, "Not available")} → {text(entry.afterStatus, "Not available")}</p> : null}</div>
            <time className="text-muted md:text-right">{date(entry.createdAt)}</time>
          </article>
        ))}</div> : <Empty>No account history available.</Empty>}
      </Panel></div>
    </AppShell>
  );
}
