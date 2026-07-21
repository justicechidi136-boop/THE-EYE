import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { KycReviewButton } from "../../../components/kyc-review-button";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchPendingKyc } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function PendingKycPage() {
  const rows = await fetchPendingKyc();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Identity"
        title="KYC review queue"
        action={
          <Link href="/users" className="text-sm text-accent underline">
            Back to users
          </Link>
        }
      />
      <Panel title="Pending submissions">
        <div className="space-y-3">
          {rows.length ? (
            rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-line bg-surfaceMuted p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.citizen.displayName}</p>
                    <p className="mt-1 text-sm text-muted">
                      {row.documentType} · {row.citizen.email ?? row.citizen.phone ?? "No contact"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge tone="warning">{row.status}</StatusBadge>
                      <StatusBadge>
                        {[row.citizen.lga, row.citizen.state, row.citizen.country]
                          .filter(Boolean)
                          .join(", ") || "Unscoped"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Submitted {new Date(row.createdAt).toLocaleString()}
                    </p>
                    <Link
                      href={`/users/${row.userId}`}
                      className="mt-2 inline-block text-sm text-accent underline"
                    >
                      Open citizen profile
                    </Link>
                  </div>
                  <div className="flex flex-col gap-2">
                    <KycReviewButton kycId={row.id} decision="approve" />
                    <KycReviewButton kycId={row.id} decision="reject" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No pending KYC submissions in your jurisdiction.</p>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
