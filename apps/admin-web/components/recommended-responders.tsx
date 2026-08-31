"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  formatRecommendationDistance,
  recommendationGroupLabel,
  recommendationNavigationUrl,
  type AgencyRecommendation,
  type AgencyRecommendationResponse,
  type RecommendationTier,
} from "../lib/agency-recommendations";
import { StatusBadge } from "./ui";

const groups: Array<{ tier: RecommendationTier; key: keyof Pick<AgencyRecommendationResponse, "actionableRecommendations" | "structuralMatches" | "informationalMatches"> }> = [
  { tier: "PRIMARY", key: "actionableRecommendations" },
  { tier: "SECONDARY", key: "actionableRecommendations" },
  { tier: "STRUCTURAL_ONLY", key: "structuralMatches" },
  { tier: "INFORMATIONAL", key: "informationalMatches" },
];

export function RecommendedResponders({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<AgencyRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/admin/incidents/${encodeURIComponent(incidentId)}/agency-recommendations`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Agency recommendation preview failed");
      setData(await response.json() as AgencyRecommendationResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface shadow-sm" aria-labelledby="recommended-responders-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="recommended-responders-title" className="text-base font-semibold text-ink">Recommended Responders</h2>
          <p className="mt-1 text-xs text-muted">Internal advisory directory matches. No agency is contacted from this section.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-10 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-surfaceMuted disabled:cursor-wait disabled:opacity-60">
          Refresh Recommendations
        </button>
      </div>
      <div className="p-4">
        {loading ? <RecommendationLoading /> : null}
        {!loading && error ? <p role="status" className="rounded-md border border-line bg-surfaceMuted p-4 text-sm text-muted">Agency recommendations are temporarily unavailable.</p> : null}
        {!loading && !error && data ? <RecommendationResults data={data} /> : null}
      </div>
    </section>
  );
}

export function RecommendationResults({ data }: { data: AgencyRecommendationResponse }) {
  const all = [...data.actionableRecommendations, ...data.structuralMatches, ...data.informationalMatches];
  const actionable = data.actionableRecommendations.filter((item) => item.tier === "PRIMARY" || item.tier === "SECONDARY");
  if (!all.length) {
    return <p className="rounded-md border border-line bg-surfaceMuted p-4 text-sm text-muted">No verified agency recommendation is currently available for this incident.</p>;
  }
  return (
    <div className="grid gap-5">
      {!actionable.length ? (
        <div className="rounded-md border border-info/30 bg-info/10 p-4 text-sm text-ink">
          <p className="font-semibold">No verified operational responder is currently available in THE EYE directory for this incident and jurisdiction.</p>
          <p className="mt-1 text-muted">Relevant verified agency structures are shown below.</p>
        </div>
      ) : null}
      {groups.map(({ tier, key }) => {
        const items = data[key].filter((item) => item.tier === tier);
        if (!items.length) return null;
        return (
          <div key={tier} className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">{recommendationGroupLabel(tier)}</h3>
            <div className="grid gap-3 xl:grid-cols-2">
              {items.map((item) => <RecommendationItem key={`${item.agencyId}:${item.officeId ?? tier}`} item={item} />)}
            </div>
          </div>
        );
      })}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer font-semibold">Recommendation details</summary>
        <p className="mt-2">Rules: {data.ruleVersion}</p>
        <p className="mt-1">Location: {[data.input.geography.wardName, data.input.geography.lgaName, data.input.geography.stateName, data.input.geography.countryName].filter(Boolean).join(", ")}</p>
      </details>
    </div>
  );
}

function RecommendationItem({ item }: { item: AgencyRecommendation }) {
  const navigationUrl = recommendationNavigationUrl(item);
  const emergencyContacts = item.publicContacts.filter((contact) => contact.emergencyOnly || contact.type === "EMERGENCY_PHONE");
  const publicContacts = item.publicContacts.filter((contact) => !emergencyContacts.includes(contact));
  const structural = item.tier === "STRUCTURAL_ONLY";
  return (
    <article className="min-w-0 rounded-md border border-line bg-surfaceMuted p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words font-semibold text-ink">{item.agencyName}</h4>
          {item.officeName ? <p className="mt-1 break-words text-sm text-muted">{item.officeName}</p> : null}
        </div>
        <StatusBadge tone={item.operationalReady ? "success" : structural ? "info" : "neutral"}>{item.tier.replaceAll("_", " ")}</StatusBadge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Info label="Capability" value={item.capability} />
        <Info label="Jurisdiction" value={item.jurisdictionLevel.replaceAll("_", " ")} />
        <Info label="Readiness" value={item.operationalReady ? "Verified operational directory endpoint" : "Directory evidence only"} />
        <Info label="Verification" value={item.verificationStatus.replaceAll("_", " ")} />
        <Info label="Distance" value={formatRecommendationDistance(item.distanceMeters)} />
        {item.publicAddress ? <Info label="Verified public address" value={item.publicAddress} /> : null}
      </dl>
      <div className="mt-4 text-sm">
        <p className="font-semibold text-ink">Why this is recommended</p>
        <ul className="mt-1 grid gap-1 text-muted">{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </div>
      {structural ? <p className="mt-4 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-ink">Relevant agency structure verified, but THE EYE does not currently have a verified operational endpoint for this match.</p> : null}
      {item.limitations.length ? <div className="mt-4 text-sm"><p className="font-semibold text-ink">Limitations</p><ul className="mt-1 grid gap-1 text-muted">{item.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div> : null}
      {emergencyContacts.length ? <ContactList label="Verified emergency contact" contacts={emergencyContacts} /> : null}
      {publicContacts.length ? <ContactList label="Verified public contact" contacts={publicContacts} /> : null}
      {navigationUrl ? <a href={navigationUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center rounded-md border border-eye px-3 py-2 text-sm font-semibold text-eye hover:bg-eye/10">Open Navigation</a> : null}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs uppercase text-muted">{label}</dt><dd className="mt-1 break-words font-medium text-ink">{value}</dd></div>;
}

function ContactList({ label, contacts }: { label: string; contacts: AgencyRecommendation["publicContacts"] }) {
  return <div className="mt-4 text-sm"><p className="font-semibold text-ink">{label}</p>{contacts.map((contact) => <p key={`${contact.type}:${contact.value}`} className="mt-1 break-words text-muted">{contact.label ? `${contact.label}: ` : ""}{contact.value}</p>)}</div>;
}

function RecommendationLoading() {
  return <div role="status" aria-label="Loading agency recommendations" className="grid gap-3 sm:grid-cols-2"><div className="h-36 animate-pulse rounded-md bg-surfaceMuted" /><div className="h-36 animate-pulse rounded-md bg-surfaceMuted" /></div>;
}
