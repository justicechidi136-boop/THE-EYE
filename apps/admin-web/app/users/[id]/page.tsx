import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchCitizenDetail } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function CitizenDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await fetchCitizenDetail(id);
  if (!detail) notFound();

  const profile = (detail.profile as Record<string, unknown> | null) ?? null;
  const contacts = Array.isArray(detail.emergencyContacts)
    ? (detail.emergencyContacts as Array<Record<string, unknown>>)
    : [];
  const kycHistory = Array.isArray(detail.kycHistory)
    ? (detail.kycHistory as Array<Record<string, unknown>>)
    : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Citizen profile"
        title={String(
          [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
            detail.email ||
            detail.phone ||
            "Citizen",
        )}
        action={
          <div className="flex gap-3 text-sm">
            <Link href="/users/kyc" className="text-accent underline">
              KYC queue
            </Link>
            <Link href="/users" className="text-accent underline">
              Directory
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Identity">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd>{String(detail.email ?? "—")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Phone</dt>
              <dd>{String(detail.phone ?? "—")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge>{String(detail.status ?? "—")}</StatusBadge>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Profile complete</dt>
              <dd>{detail.profileComplete ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Trust score</dt>
              <dd>
                {detail.trustScore === null || detail.trustScore === undefined
                  ? "Not rated"
                  : String(detail.trustScore)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Jurisdiction</dt>
              <dd>
                {[profile?.lga, profile?.state, profile?.country].filter(Boolean).join(", ") ||
                  "Unset"}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="KYC">
          <p className="mb-3 text-sm">
            Current status: <StatusBadge tone="info">{String(detail.kycStatus ?? "Unverified")}</StatusBadge>
          </p>
          <div className="space-y-2">
            {kycHistory.length ? (
              kycHistory.map((row) => (
                <div key={String(row.id)} className="rounded border border-line p-3 text-sm">
                  <p className="font-medium">
                    {String(row.documentType)} · {String(row.status)}
                  </p>
                  {row.rejectionReason ? (
                    <p className="mt-1 text-muted">{String(row.rejectionReason)}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No KYC submissions.</p>
            )}
          </div>
        </Panel>

        <Panel title="Emergency contacts">
          <div className="space-y-2">
            {contacts.length ? (
              contacts.map((contact) => (
                <div key={String(contact.id)} className="rounded border border-line p-3 text-sm">
                  <p className="font-medium">{String(contact.name)}</p>
                  <p className="text-muted">
                    {String(contact.relationship)} · {String(contact.phone)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No emergency contacts on file.</p>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
