import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { apiRequest } from "../../../lib/api/client";
import {
  recommendationReviewLabel,
  recommendationReviewOutcomes,
  type AgencyRecommendationQualityReport,
  type RecommendationReviewOutcome,
} from "../../../lib/agency-recommendations";
import { getAccessToken } from "../../../lib/session";

export const dynamic = "force-dynamic";

const tiers = ["PRIMARY", "SECONDARY", "STRUCTURAL_ONLY", "INFORMATIONAL"];
const incidentTypes = ["Emergency", "Crime", "Accident", "Fire", "Medical", "CommunitySafety", "Kidnapping", "Abuse", "SuspiciousActivity", "MissingPerson", "StolenVehicle", "SOS"];
const acceptanceRateDefinition = "ACCEPTED_AS_RELEVANT / TOTAL REVIEWED";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value));
}

export default async function RecommendationQualityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const token = await getAccessToken();
  let report: AgencyRecommendationQualityReport | null = null;
  let error = false;
  if (token) {
    try {
      report = await apiRequest<AgencyRecommendationQualityReport>(
        "/admin/agency-directory/recommendations/reviews/quality",
        { token, query: params },
      );
    } catch {
      error = true;
    }
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Internal recommendation QA" title="Recommendation Quality" action={<Link href="/incidents" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-surfaceMuted">Return to Reports</Link>} />
      <p className="mb-6 max-w-3xl text-sm text-muted">This report evaluates whether THE EYE directory recommendations were appropriate. Reviews do not contact, assign, notify, or dispatch any responder.</p>

      {error || !report ? <div role="status" className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">Recommendation quality data is temporarily unavailable.</div> : (
        <div className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total reviewed" value={String(report.summary.totalReviewed)} />
            <MetricCard label="Relevant" value={String(report.summary.ACCEPTED_AS_RELEVANT)} accent="eye" />
            <MetricCard label="Insufficient operational data" value={String(report.summary.INSUFFICIENT_OPERATIONAL_DATA)} />
            <MetricCard label="Acceptance rate" value={report.summary.acceptanceRate == null ? "Not available" : `${(report.summary.acceptanceRate * 100).toFixed(1)}%`} detail={acceptanceRateDefinition} />
          </div>

          <Panel title="Filters">
            <form method="get" className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              <FilterInput label="Rule version" name="ruleVersion" value={params.ruleVersion ?? "agency-recommendation-v1"} />
              <FilterSelect label="State/FCT" name="stateId" value={params.stateId} options={report.filters.states.map((item) => ({ value: item.id, label: item.name }))} />
              <FilterSelect label="Incident type" name="incidentType" value={params.incidentType} options={incidentTypes.map((value) => ({ value, label: value.replace(/([a-z])([A-Z])/g, "$1 $2") }))} />
              <FilterSelect label="Agency" name="agencyId" value={params.agencyId} options={report.filters.agencies.map((item) => ({ value: item.id, label: item.name }))} />
              <FilterSelect label="Tier" name="tier" value={params.tier} options={tiers.map((value) => ({ value, label: value.replaceAll("_", " ") }))} />
              <FilterSelect label="Outcome" name="outcome" value={params.outcome} options={recommendationReviewOutcomes.map((value) => ({ value, label: recommendationReviewLabel(value) }))} />
              <FilterInput label="Reviewed from" name="reviewedFrom" value={params.reviewedFrom} type="date" />
              <FilterInput label="Reviewed to" name="reviewedTo" value={params.reviewedTo} type="date" />
              <div className="flex items-end gap-2 md:col-span-3 xl:col-span-4"><button type="submit" className="min-h-10 rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white">Apply filters</button><Link href="/agencies/recommendation-quality" className="inline-flex min-h-10 items-center rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink">Clear</Link></div>
            </form>
          </Panel>

          <Panel title="Outcome counts">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{recommendationReviewOutcomes.map((outcome) => <div key={outcome} className="rounded-md border border-line bg-surfaceMuted p-3"><p className="text-xs text-muted">{recommendationReviewLabel(outcome)}</p><p className="mt-1 text-xl font-semibold text-ink">{report.summary[outcome]}</p></div>)}</div>
          </Panel>

          <Panel title="Reviewed recommendations">
            {!report.reviews.length ? <p className="py-6 text-center text-sm text-muted">No recommendation reviews match these filters.</p> : (
              <div data-admin-horizontal-scroll className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-surfaceMuted text-xs uppercase text-muted"><tr>{["Reviewed", "Agency / endpoint", "State/FCT", "Incident", "Tier", "Outcome", "Internal note"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-line">{report.reviews.map((review) => <tr key={review.id} className="align-top"><td className="whitespace-nowrap px-3 py-3 text-muted">{formatDate(review.reviewedAt)}</td><td className="px-3 py-3"><p className="font-semibold text-ink">{review.agencyName}</p><p className="text-xs text-muted">{review.endpointName ?? "Structural agency match"}</p></td><td className="px-3 py-3">{review.stateName}</td><td className="px-3 py-3">{review.incidentType}</td><td className="px-3 py-3"><StatusBadge>{review.recommendationTier.replaceAll("_", " ")}</StatusBadge></td><td className="px-3 py-3 font-medium">{recommendationReviewLabel(review.outcome)}</td><td className="max-w-sm break-words px-3 py-3 text-muted">{review.note || "No note"}</td></tr>)}</tbody></table></div>
            )}
          </Panel>

          <Panel title="Directory data-quality findings">
            {!report.dataQualityFindings.length ? <p className="text-sm text-muted">No human-review directory findings match these filters.</p> : <div className="grid gap-3">{report.dataQualityFindings.map((finding) => <article key={finding.reviewId} className="rounded-md border border-line bg-surfaceMuted p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-ink">{finding.agencyName}</p><StatusBadge tone="warning">Human review required</StatusBadge></div><p className="mt-2 text-sm text-muted">{recommendationReviewLabel(finding.findingType as RecommendationReviewOutcome)} · {finding.stateName}</p>{finding.note ? <p className="mt-2 text-sm text-ink">{finding.note}</p> : null}<p className="mt-2 text-xs text-muted">No directory record was changed automatically.</p></article>)}</div>}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}

function FilterInput({ label, name, value, type = "text" }: { label: string; name: string; value?: string; type?: string }) {
  return <label className="grid gap-1 text-sm"><span className="font-medium text-ink">{label}</span><input type={type} name={name} defaultValue={value ?? ""} className="h-11 rounded-md border border-line bg-surface px-3" /></label>;
}

function FilterSelect({ label, name, value, options }: { label: string; name: string; value?: string; options: Array<{ value: string; label: string }> }) {
  return <label className="grid gap-1 text-sm"><span className="font-medium text-ink">{label}</span><select name={name} defaultValue={value ?? ""} className="h-11 rounded-md border border-line bg-surface px-3"><option value="">All</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
