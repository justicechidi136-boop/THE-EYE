"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FormField, SelectInput, TextInput } from "../form-primitives";
import type { PolicySection, ResolvedPolicy } from "../../lib/api/policies";

type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];
};

const POLICY_FIELDS: Record<PolicySection, FieldSpec[]> = {
  community: [
    { key: "defaultVisibility", label: "Default visibility", type: "select", options: ["Public", "Private"] },
    { key: "membershipRequiresApproval", label: "Membership requires approval", type: "boolean" },
    { key: "maxHierarchyDepth", label: "Max hierarchy depth", type: "number" },
  ],
  permissions: [
    { key: "moderatorCanBan", label: "Moderators can ban members", type: "boolean" },
    { key: "moderatorCanAssignRoles", label: "Moderators can assign roles", type: "boolean" },
    { key: "allowVolunteerEscalation", label: "Allow volunteer escalation", type: "boolean" },
  ],
  notifications: [
    { key: "criticalIncidentPush", label: "Critical incident push", type: "boolean" },
    { key: "broadcastApprovalPush", label: "Broadcast approval push", type: "boolean" },
    { key: "liveVideoAlertPush", label: "Live video alert push", type: "boolean" },
    { key: "quietHoursEnabled", label: "Quiet hours enabled", type: "boolean" },
    { key: "quietHoursStart", label: "Quiet hours start", type: "text" },
    { key: "quietHoursEnd", label: "Quiet hours end", type: "text" },
  ],
  broadcasts: [
    { key: "autoApproveP1Emergency", label: "Auto-approve P1 emergency", type: "boolean" },
    { key: "defaultRadiusMeters", label: "Default radius (meters)", type: "number" },
    { key: "minApprovers", label: "Minimum approvers", type: "number" },
  ],
  verification: [
    { key: "autoVerifyThreshold", label: "Auto-verify threshold", type: "number" },
    { key: "manualReviewThreshold", label: "Manual review threshold", type: "number" },
    { key: "falseReportThreshold", label: "False report threshold", type: "number" },
    { key: "requireWitnessCount", label: "Required witness count", type: "number" },
  ],
  patrols: [
    { key: "minCheckpoints", label: "Minimum checkpoints", type: "number" },
    { key: "maxPatrolDurationHours", label: "Max patrol duration (hours)", type: "number" },
    { key: "requireGpsCheckIn", label: "Require GPS check-in", type: "boolean" },
  ],
  volunteers: [
    { key: "requireKyc", label: "Require KYC", type: "boolean" },
    { key: "minTrustScore", label: "Minimum trust score", type: "number" },
    { key: "maxActivePatrols", label: "Max active patrols", type: "number" },
  ],
  smartwatch: [
    { key: "defaultSosTtlMinutes", label: "Default SOS TTL (minutes)", type: "number" },
    { key: "pairingSessionTtlMinutes", label: "Pairing session TTL (minutes)", type: "number" },
    { key: "allowStandaloneMode", label: "Allow standalone mode", type: "boolean" },
  ],
  integrations: [
    { key: "smsProvider", label: "SMS provider", type: "select", options: ["termii", "twilio", "none"] },
    { key: "gisWebhookUrl", label: "GIS webhook URL", type: "text" },
    { key: "webhookEnabled", label: "Webhook enabled", type: "boolean" },
  ],
};

export function PolicySectionPanel({
  section,
  title,
  description,
  policy,
  canManage = false,
  scope = "jurisdiction",
  communityId,
  anchorId,
}: Readonly<{
  section: PolicySection;
  title: string;
  description: string;
  policy: ResolvedPolicy | null;
  canManage?: boolean;
  scope?: "platform" | "jurisdiction" | "community";
  communityId?: string;
  anchorId: string;
}>) {
  const router = useRouter();
  const [config, setConfig] = useState<Record<string, unknown>>(policy?.config ?? {});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/policies/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, communityId, config }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Save failed");
      }
      setMessage("Policy saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id={anchorId} className="rounded-lg border border-line bg-surface p-4 scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm text-muted">{description}</p>
          <p className="mt-2 text-xs text-muted">
            Source: {policy?.source ?? "default"} · Version: {policy?.version ?? 0}
            {policy?.updatedAt ? ` · Updated ${new Date(policy.updatedAt).toLocaleString()}` : ""}
          </p>
        </div>
        {canManage ? (
          <Button type="button" disabled={loading} onClick={handleSave}>
            {loading ? "Saving..." : "Save policy"}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {POLICY_FIELDS[section].map((field) => {
          const value = config[field.key];
          if (field.type === "boolean") {
            return (
              <label key={field.key} className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  disabled={!canManage}
                  onChange={(event) => setConfig((current) => ({ ...current, [field.key]: event.target.checked }))}
                />
                <span>{field.label}</span>
              </label>
            );
          }
          if (field.type === "select") {
            return (
              <FormField key={field.key} label={field.label}>
                <SelectInput
                  value={String(value ?? field.options?.[0] ?? "")}
                  disabled={!canManage}
                  onChange={(event) => setConfig((current) => ({ ...current, [field.key]: event.target.value }))}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </SelectInput>
              </FormField>
            );
          }
          return (
            <FormField key={field.key} label={field.label}>
              <TextInput
                type={field.type === "number" ? "number" : "text"}
                value={String(value ?? "")}
                disabled={!canManage}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value,
                  }))
                }
              />
            </FormField>
          );
        })}
      </div>
      {message ? <p className="mt-3 text-sm text-eye">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
