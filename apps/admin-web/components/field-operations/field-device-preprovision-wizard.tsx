"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_PROFILE_ASSIGNABLE_PERMISSIONS, FieldActivationPolicy, FieldOperationalRole } from "@the-eye/shared";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import { Panel } from "../ui";
import type { FieldPermissionEffectivePreviewView, FieldPermissionProfileView } from "../../lib/types/admin-views";
import { PermissionGroupPicker } from "./permission-group-picker";
import { PermissionSummaryList } from "./permission-summary-list";

type WizardValues = {
  deviceName: string;
  inventoryAssetRef: string;
  notes: string;
  agencyId: string;
  countryCode: string;
  stateCode: string;
  lgaCode: string;
  assignedUserId: string;
  assignedUnitId: string;
  assignedTeamId: string;
  operationalRole: string;
  permissionProfileId: string;
  permissionOverrides: string[];
  permissionDenies: string[];
  deviceMode: string;
  activationPolicy: string;
  activationExpiresAt: string;
  reviewAt: string;
};

const DEFAULT_VALUES: WizardValues = {
  deviceName: "",
  inventoryAssetRef: "",
  notes: "",
  agencyId: "",
  countryCode: "",
  stateCode: "",
  lgaCode: "",
  assignedUserId: "",
  assignedUnitId: "",
  assignedTeamId: "",
  operationalRole: "",
  permissionProfileId: "",
  permissionOverrides: [],
  permissionDenies: [],
  deviceMode: "standard",
  activationPolicy: FieldActivationPolicy.RequireSupervisorFinalApproval,
  activationExpiresAt: "",
  reviewAt: "",
};

const STEPS = ["Identity", "Agency", "Assignment", "Permission Profile", "Device Mode", "Review"] as const;

function toIsoOrUndefined(localDateTimeValue: string): string | undefined {
  if (!localDateTimeValue) return undefined;
  const date = new Date(localDateTimeValue);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function FieldDevicePreprovisionWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(DEFAULT_VALUES);
  const [profiles, setProfiles] = useState<FieldPermissionProfileView[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [actorCeiling, setActorCeiling] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<FieldPermissionEffectivePreviewView | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/field-permission-profiles?isActive=true");
        const payload = (await response.json()) as { data?: FieldPermissionProfileView[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Unable to load permission profiles");
        if (!cancelled) setProfiles(payload.data ?? []);
      } catch (error) {
        if (!cancelled) setProfilesError(error instanceof Error ? error.message : "Unable to load permission profiles");
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/field-permissions/effective-preview");
        const payload = (await response.json()) as { data?: FieldPermissionEffectivePreviewView; message?: string };
        if (response.ok && payload.data && !cancelled) setActorCeiling(payload.data.actorCeiling);
      } catch {
        // Non-fatal: ceiling is a UX hint only, server re-validates on submit.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof WizardValues>(field: K, value: WizardValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === values.permissionProfileId) ?? null,
    [profiles, values.permissionProfileId],
  );

  const overridesCatalog = useMemo(
    () => FIELD_PROFILE_ASSIGNABLE_PERMISSIONS.filter((code) => !(selectedProfile?.permissions ?? []).includes(code)),
    [selectedProfile],
  );
  const deniesCatalog = useMemo(() => selectedProfile?.permissions ?? [], [selectedProfile]);
  const ceilingDisabled = useMemo(
    () => (actorCeiling ? FIELD_PROFILE_ASSIGNABLE_PERMISSIONS.filter((code) => !actorCeiling.includes(code)) : []),
    [actorCeiling],
  );

  useEffect(() => {
    if (step !== 5) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (values.permissionProfileId) params.set("profileId", values.permissionProfileId);
        if (values.permissionOverrides.length) params.set("overrides", values.permissionOverrides.join(","));
        if (values.permissionDenies.length) params.set("denies", values.permissionDenies.join(","));
        const response = await fetch(`/api/admin/field-permissions/effective-preview?${params.toString()}`);
        const payload = (await response.json()) as { data?: FieldPermissionEffectivePreviewView; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Unable to compute effective permissions");
        if (!cancelled) setPreview(payload.data ?? null);
      } catch (error) {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : "Unable to compute effective permissions");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, values.permissionProfileId, values.permissionOverrides, values.permissionDenies]);

  function validateStep(index: number): string | null {
    if (index === 0 && !values.deviceName.trim()) return "Device name is required.";
    return null;
  }

  function goNext() {
    const error = validateStep(step);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleCreate() {
    const error = validateStep(0);
    if (error) {
      setStepError(error);
      setStep(0);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        deviceName: values.deviceName.trim(),
        inventoryAssetRef: values.inventoryAssetRef.trim() || undefined,
        notes: values.notes.trim() || undefined,
        agencyId: values.agencyId.trim() || undefined,
        countryCode: values.countryCode.trim() || undefined,
        stateCode: values.stateCode.trim() || undefined,
        lgaCode: values.lgaCode.trim() || undefined,
        assignedUserId: values.assignedUserId.trim() || undefined,
        assignedUnitId: values.assignedUnitId.trim() || undefined,
        assignedTeamId: values.assignedTeamId.trim() || undefined,
        operationalRole: values.operationalRole || undefined,
        permissionProfileId: values.permissionProfileId || undefined,
        permissionOverrides: values.permissionOverrides.length ? values.permissionOverrides : undefined,
        permissionDenies: values.permissionDenies.length ? values.permissionDenies : undefined,
        deviceMode: values.deviceMode || undefined,
        activationPolicy: values.activationPolicy || undefined,
        activationExpiresAt: toIsoOrUndefined(values.activationExpiresAt),
        reviewAt: toIsoOrUndefined(values.reviewAt),
      };
      const response = await fetch("/api/admin/field-devices/preprovision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { data?: { id?: string }; message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to pre-provision field device");
      const id = result.data?.id;
      if (id) {
        router.push(`/field-operations/devices/${id}`);
        router.refresh();
      } else {
        router.push("/field-operations/devices");
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to pre-provision field device");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Pre-provision field device">
      <ol className="mb-5 flex flex-wrap gap-2 text-xs font-semibold">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-full border px-3 py-1.5 transition-colors ${
                index === step
                  ? "border-eye bg-eye text-white"
                  : index < step
                    ? "border-eye/40 bg-eye/10 text-eye"
                    : "border-line bg-surfaceMuted text-muted"
              }`}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid gap-3">
          <FormField label="Device name" htmlFor="wizard-device-name" hint="Shown to the assigned officer and in admin lists.">
            <TextInput
              id="wizard-device-name"
              value={values.deviceName}
              onChange={(event) => updateField("deviceName", event.target.value)}
              placeholder="Patrol Tablet 014"
            />
          </FormField>
          <FormField label="Inventory asset reference" htmlFor="wizard-inventory-ref" hint="Optional asset tag / serial from the inventory system.">
            <TextInput
              id="wizard-inventory-ref"
              value={values.inventoryAssetRef}
              onChange={(event) => updateField("inventoryAssetRef", event.target.value)}
              placeholder="INV-2026-00214"
            />
          </FormField>
          <FormField label="Notes" htmlFor="wizard-notes" hint="Optional context for other supervisors reviewing this device.">
            <textarea
              id="wizard-notes"
              className="min-h-[88px] rounded-md border border-line bg-surface px-3 py-2 text-sm"
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </FormField>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-3">
          <InlineAlert tone="info">
            No agency registry API is available yet (see <code className="text-xs">GET /v1/agencies</code> in missing backend
            assumptions). Enter the agency ID exactly as issued by your records team.
          </InlineAlert>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Agency ID" htmlFor="wizard-agency-id" hint="Defaults to your own agency if left blank.">
              <TextInput id="wizard-agency-id" value={values.agencyId} onChange={(event) => updateField("agencyId", event.target.value)} />
            </FormField>
            <FormField label="Country code" htmlFor="wizard-country" hint="Defaults to your assigned jurisdiction if left blank.">
              <TextInput id="wizard-country" value={values.countryCode} onChange={(event) => updateField("countryCode", event.target.value)} placeholder="NG" />
            </FormField>
            <FormField label="State code" htmlFor="wizard-state">
              <TextInput id="wizard-state" value={values.stateCode} onChange={(event) => updateField("stateCode", event.target.value)} placeholder="LA" />
            </FormField>
            <FormField label="LGA code" htmlFor="wizard-lga">
              <TextInput id="wizard-lga" value={values.lgaCode} onChange={(event) => updateField("lgaCode", event.target.value)} />
            </FormField>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Assigned officer user ID" htmlFor="wizard-assigned-user" hint="Optional — can be assigned later during approval.">
            <TextInput id="wizard-assigned-user" value={values.assignedUserId} onChange={(event) => updateField("assignedUserId", event.target.value)} />
          </FormField>
          <FormField label="Assigned unit ID" htmlFor="wizard-assigned-unit">
            <TextInput id="wizard-assigned-unit" value={values.assignedUnitId} onChange={(event) => updateField("assignedUnitId", event.target.value)} />
          </FormField>
          <FormField label="Assigned team ID" htmlFor="wizard-assigned-team">
            <TextInput id="wizard-assigned-team" value={values.assignedTeamId} onChange={(event) => updateField("assignedTeamId", event.target.value)} />
          </FormField>
          <FormField label="Operational role" htmlFor="wizard-operational-role">
            <SelectInput
              id="wizard-operational-role"
              value={values.operationalRole}
              onChange={(event) => updateField("operationalRole", event.target.value)}
            >
              <option value="">Not set</option>
              {Object.values(FieldOperationalRole).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-4">
          {profilesError ? <InlineAlert tone="error">{profilesError}</InlineAlert> : null}
          {profilesLoading ? (
            <p className="text-sm text-muted">Loading permission profiles…</p>
          ) : (
            <div className="grid gap-2">
              <label className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="wizard-profile"
                  checked={!values.permissionProfileId}
                  onChange={() => updateField("permissionProfileId", "")}
                />
                <span className="font-semibold text-ink">No profile (assign later)</span>
              </label>
              {profiles.map((profile) => (
                <div key={profile.id} className="rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="wizard-profile"
                      checked={values.permissionProfileId === profile.id}
                      onChange={() => updateField("permissionProfileId", profile.id)}
                    />
                    <span>
                      <span className="font-semibold text-ink">{profile.name}</span>{" "}
                      <span className="text-xs text-muted">({profile.code})</span>
                      {profile.isSystem ? <span className="ml-2 text-xs text-muted">System</span> : null}
                    </span>
                  </label>
                  {profile.description ? <p className="mt-1 pl-6 text-xs text-muted">{profile.description}</p> : null}
                  <details className="mt-1 pl-6">
                    <summary className="cursor-pointer text-xs font-medium text-eye hover:underline">
                      {profile.permissions.length} permission{profile.permissions.length === 1 ? "" : "s"} granted
                    </summary>
                    <div className="mt-2">
                      <PermissionSummaryList codes={profile.permissions} />
                    </div>
                  </details>
                </div>
              ))}
              {!profiles.length ? (
                <p className="text-sm text-muted">
                  No active permission profiles yet. Create one under Field Operations → Permission Profiles first, or continue
                  without a profile and assign one later from the device page.
                </p>
              ) : null}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Additional grants (overrides)</p>
            <p className="mb-2 text-xs text-muted">Extra permissions beyond the selected profile, limited to your delegation authority.</p>
            <PermissionGroupPicker
              value={values.permissionOverrides}
              onChange={(next) => updateField("permissionOverrides", next)}
              availablePermissions={overridesCatalog}
              disabledPermissions={ceilingDisabled}
              emptyLabel="Select a profile with room to grant additional permissions."
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Restrictions (denies)</p>
            <p className="mb-2 text-xs text-muted">Remove specific permissions the profile would otherwise grant.</p>
            <PermissionGroupPicker
              value={values.permissionDenies}
              onChange={(next) => updateField("permissionDenies", next)}
              availablePermissions={deniesCatalog}
              emptyLabel="Select a permission profile to enable denies."
            />
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Device mode" htmlFor="wizard-device-mode">
            <SelectInput id="wizard-device-mode" value={values.deviceMode} onChange={(event) => updateField("deviceMode", event.target.value)}>
              <option value="standard">Standard</option>
              <option value="launcher">Launcher</option>
              <option value="managed_kiosk">Managed kiosk</option>
            </SelectInput>
          </FormField>
          <FormField label="Activation policy" htmlFor="wizard-activation-policy">
            <SelectInput
              id="wizard-activation-policy"
              value={values.activationPolicy}
              onChange={(event) => updateField("activationPolicy", event.target.value)}
            >
              <option value={FieldActivationPolicy.RequireSupervisorFinalApproval}>Require supervisor final approval</option>
              <option value={FieldActivationPolicy.AutoActivateOnPairing}>Auto-activate on pairing</option>
            </SelectInput>
          </FormField>
          <FormField label="Activation expires at" htmlFor="wizard-activation-expiry" hint="Optional deadline for pairing to complete.">
            <TextInput
              id="wizard-activation-expiry"
              type="datetime-local"
              value={values.activationExpiresAt}
              onChange={(event) => updateField("activationExpiresAt", event.target.value)}
            />
          </FormField>
          <FormField label="Review by" htmlFor="wizard-review-at" hint="Optional reminder date for supervisor follow-up.">
            <TextInput
              id="wizard-review-at"
              type="datetime-local"
              value={values.reviewAt}
              onChange={(event) => updateField("reviewAt", event.target.value)}
            />
          </FormField>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="grid gap-4">
          <div className="grid gap-2 rounded-md border border-line bg-surfaceMuted p-4 text-sm md:grid-cols-2">
            <p><span className="font-semibold">Device name:</span> {values.deviceName || "-"}</p>
            <p><span className="font-semibold">Inventory ref:</span> {values.inventoryAssetRef || "-"}</p>
            <p><span className="font-semibold">Agency:</span> {values.agencyId || "Defaults to your agency"}</p>
            <p><span className="font-semibold">Jurisdiction:</span> {[values.countryCode, values.stateCode, values.lgaCode].filter(Boolean).join(" / ") || "Defaults to your jurisdiction"}</p>
            <p><span className="font-semibold">Assigned officer:</span> {values.assignedUserId || "Unassigned"}</p>
            <p><span className="font-semibold">Assigned unit:</span> {values.assignedUnitId || "-"}</p>
            <p><span className="font-semibold">Assigned team:</span> {values.assignedTeamId || "-"}</p>
            <p><span className="font-semibold">Operational role:</span> {values.operationalRole || "Not set"}</p>
            <p><span className="font-semibold">Permission profile:</span> {selectedProfile ? `${selectedProfile.name} (${selectedProfile.code})` : "None"}</p>
            <p><span className="font-semibold">Device mode:</span> {values.deviceMode}</p>
            <p><span className="font-semibold">Activation policy:</span> {values.activationPolicy}</p>
            <p><span className="font-semibold">Activation expires:</span> {values.activationExpiresAt || "-"}</p>
            <p><span className="font-semibold">Review by:</span> {values.reviewAt || "-"}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Effective permissions preview</p>
            {previewLoading ? <p className="text-sm text-muted">Calculating…</p> : null}
            {previewError ? <InlineAlert tone="error">{previewError}</InlineAlert> : null}
            {preview ? (
              <div className="grid gap-2">
                {!preview.withinAuthority ? (
                  <InlineAlert tone="warning">
                    This selection exceeds your delegation authority. Excess permissions:{" "}
                    {preview.excessPermissions.join(", ") || "none"}. The server will reject creation until this is resolved.
                  </InlineAlert>
                ) : null}
                <PermissionSummaryList codes={preview.effectivePermissions} emptyLabel="No permissions will be granted to this device." />
              </div>
            ) : null}
          </div>

          {submitError ? <InlineAlert tone="error">{submitError}</InlineAlert> : null}
        </div>
      ) : null}

      {stepError ? (
        <div className="mt-4">
          <InlineAlert tone="error">{stepError}</InlineAlert>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="secondary" onClick={goBack} disabled={step === 0 || submitting}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={goNext}>Next</Button>
        ) : (
          <Button onClick={() => void handleCreate()} disabled={submitting}>
            {submitting ? "Creating…" : "Create field device"}
          </Button>
        )}
      </div>
    </Panel>
  );
}
