"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_PROFILE_ASSIGNABLE_PERMISSIONS, FieldActivationPolicy, FieldOperationalRole } from "@the-eye/shared";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import { Panel } from "../ui";
import type {
  AgencyUnitView,
  AgencyView,
  FieldAssignableUserView,
  FieldPermissionEffectivePreviewView,
  FieldPermissionProfileView,
} from "../../lib/types/admin-views";
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
  countryCode: "NG",
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
const COUNTRY_OPTIONS = [{ code: "NG", label: "NG — Nigeria" }] as const;

function toIsoOrUndefined(localDateTimeValue: string): string | undefined {
  if (!localDateTimeValue) return undefined;
  const date = new Date(localDateTimeValue);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function profileCompatibleWithAgency(profile: FieldPermissionProfileView, agencyType: string | null): boolean {
  if (!agencyType) return true;
  const compatible = profile.compatibleAgencyTypes ?? [];
  if (!compatible.length) return true;
  return compatible.includes(agencyType);
}

export function FieldDevicePreprovisionWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(DEFAULT_VALUES);
  const [agencies, setAgencies] = useState<AgencyView[]>([]);
  const [units, setUnits] = useState<AgencyUnitView[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<FieldAssignableUserView[]>([]);
  const [assignableUsersLoading, setAssignableUsersLoading] = useState(false);
  const [assignableUsersError, setAssignableUsersError] = useState<string | null>(null);
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

  const selectedAgency = useMemo(
    () => agencies.find((agency) => agency.id === values.agencyId) ?? null,
    [agencies, values.agencyId],
  );
  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === values.assignedUnitId) ?? null,
    [units, values.assignedUnitId],
  );
  const selectedAssignedUser = useMemo(
    () => assignableUsers.find((user) => user.id === values.assignedUserId) ?? null,
    [assignableUsers, values.assignedUserId],
  );

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

  useEffect(() => {
    if (!values.countryCode) {
      setAgencies([]);
      setRegistryLoaded(false);
      setRegistryError(null);
      return;
    }
    let cancelled = false;
    setRegistryLoading(true);
    setRegistryError(null);
    setRegistryLoaded(false);
    (async () => {
      try {
        const params = new URLSearchParams({
          isFieldOperationsEnabled: "true",
          isActive: "true",
          countryCode: values.countryCode,
        });
        const response = await fetch(`/api/admin/agencies?${params.toString()}`);
        const payload = (await response.json()) as { data?: AgencyView[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Unable to load agencies");
        if (!cancelled) {
          setAgencies(payload.data ?? []);
          setRegistryLoaded(true);
        }
      } catch (error) {
        if (!cancelled) {
          setAgencies([]);
          setRegistryLoaded(false);
          setRegistryError(
            error instanceof Error
              ? error.message
              : "Agency information is temporarily unavailable. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) setRegistryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [values.countryCode]);

  useEffect(() => {
    if (!values.agencyId) {
      setUnits([]);
      setUnitsError(null);
      return;
    }
    let cancelled = false;
    setUnitsLoading(true);
    setUnitsError(null);
    (async () => {
      try {
        const response = await fetch(`/api/admin/agencies/${encodeURIComponent(values.agencyId)}/units`);
        const payload = (await response.json()) as { data?: AgencyUnitView[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Unable to load agency units");
        if (!cancelled) setUnits(payload.data ?? []);
      } catch (error) {
        if (!cancelled) {
          setUnits([]);
          setUnitsError(error instanceof Error ? error.message : "Unable to load agency units");
        }
      } finally {
        if (!cancelled) setUnitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [values.agencyId]);

  useEffect(() => {
    if (!values.agencyId) {
      setAssignableUsers([]);
      setAssignableUsersError(null);
      return;
    }
    let cancelled = false;
    setAssignableUsersLoading(true);
    setAssignableUsersError(null);
    (async () => {
      try {
        const response = await fetch(
          `/api/admin/field-devices/assignable-users?agencyId=${encodeURIComponent(values.agencyId)}`,
        );
        const payload = (await response.json()) as { data?: FieldAssignableUserView[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Unable to load assignable officers");
        if (!cancelled) setAssignableUsers(payload.data ?? []);
      } catch (error) {
        if (!cancelled) {
          setAssignableUsers([]);
          setAssignableUsersError(error instanceof Error ? error.message : "Unable to load assignable officers");
        }
      } finally {
        if (!cancelled) setAssignableUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [values.agencyId]);

  function updateField<K extends keyof WizardValues>(field: K, value: WizardValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function selectAgency(agencyId: string) {
    const agency = agencies.find((item) => item.id === agencyId) ?? null;
    setValues((current) => ({
      ...current,
      agencyId,
      assignedUnitId: "",
      assignedUserId: "",
      countryCode: agency?.countryCode || current.countryCode,
      stateCode: agency?.stateCode ?? "",
      lgaCode: agency?.lgaCode ?? "",
      permissionProfileId: "",
    }));
  }

  const compatibleProfiles = useMemo(
    () => profiles.filter((profile) => profileCompatibleWithAgency(profile, selectedAgency?.agencyType ?? null)),
    [profiles, selectedAgency?.agencyType],
  );

  const selectedProfile = useMemo(
    () => compatibleProfiles.find((profile) => profile.id === values.permissionProfileId) ?? null,
    [compatibleProfiles, values.permissionProfileId],
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
    if (index === 1) {
      if (registryError || !registryLoaded) {
        return "Agency information is temporarily unavailable. Please try again later.";
      }
      if (!values.agencyId) return "Select an agency to continue.";
    }
    return null;
  }

  const agencyStepBlocked = Boolean(registryError) || (!registryLoaded && !registryLoading);

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
    const identityError = validateStep(0);
    if (identityError) {
      setStepError(identityError);
      setStep(0);
      return;
    }
    const agencyError = validateStep(1);
    if (agencyError) {
      setStepError(agencyError);
      setStep(1);
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
          <FormField label="Device name (required)" htmlFor="wizard-device-name" hint="Shown to the assigned officer and in admin lists.">
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
          {registryError ? (
            <InlineAlert tone="error">
              Agency information is temporarily unavailable. Please try again later.
            </InlineAlert>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Country" htmlFor="wizard-country">
              <SelectInput
                id="wizard-country"
                value={values.countryCode}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    countryCode: event.target.value,
                    agencyId: "",
                    assignedUnitId: "",
                    assignedUserId: "",
                    stateCode: "",
                    lgaCode: "",
                    permissionProfileId: "",
                  }));
                }}
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Agency (required)" htmlFor="wizard-agency" hint="Only active, field-operations-enabled agencies for the selected country.">
              <SelectInput
                id="wizard-agency"
                value={values.agencyId}
                disabled={registryLoading || Boolean(registryError) || !registryLoaded}
                onChange={(event) => selectAgency(event.target.value)}
              >
                <option value="">{registryLoading ? "Loading agencies…" : "Select agency"}</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name} ({agency.code})
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Unit" htmlFor="wizard-unit" hint="Optional — units for the selected agency.">
              <SelectInput
                id="wizard-unit"
                value={values.assignedUnitId}
                disabled={!values.agencyId || unitsLoading}
                onChange={(event) => updateField("assignedUnitId", event.target.value)}
              >
                <option value="">{unitsLoading ? "Loading units…" : "No unit assigned"}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.unitIdentifier})
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </div>
          {selectedAgency ? (
            <p className="text-sm text-muted">
              Jurisdiction from agency:{" "}
              {[selectedAgency.countryCode, selectedAgency.stateCode, selectedAgency.lgaCode].filter(Boolean).join(" / ") || "—"}
            </p>
          ) : null}
          {unitsError ? <InlineAlert tone="warning">{unitsError}</InlineAlert> : null}
          {!registryLoading && registryLoaded && !agencies.length && !registryError ? (
            <InlineAlert tone="info">No field-operations-enabled agencies found for this country.</InlineAlert>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Assigned officer" htmlFor="wizard-assigned-user" hint="Optional — only eligible officers within the selected agency scope are shown.">
            <SelectInput
              id="wizard-assigned-user"
              value={values.assignedUserId}
              disabled={!values.agencyId || assignableUsersLoading}
              onChange={(event) => updateField("assignedUserId", event.target.value)}
            >
              <option value="">{assignableUsersLoading ? "Loading officers…" : "Assign later"}</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} — {user.role} ({user.scope})
                </option>
              ))}
            </SelectInput>
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
          {selectedUnit ? (
            <p className="md:col-span-2 text-sm text-muted">
              Unit selected in Agency step: <span className="font-semibold text-ink">{selectedUnit.name}</span> ({selectedUnit.unitIdentifier})
            </p>
          ) : (
            <p className="md:col-span-2 text-sm text-muted">No unit selected in the Agency step.</p>
          )}
          {assignableUsersError ? <InlineAlert tone="warning">{assignableUsersError}</InlineAlert> : null}
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
              {compatibleProfiles.map((profile) => (
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
              {!compatibleProfiles.length ? (
                <p className="text-sm text-muted">
                  No active permission profiles compatible with{" "}
                  {selectedAgency ? selectedAgency.agencyType.replace(/_/g, " ") : "the selected agency"}. Create one under
                  Field Operations → Permission Profiles first, or continue without a profile and assign one later from the
                  device page.
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
            <p>
              <span className="font-semibold">Agency:</span>{" "}
              {selectedAgency ? `${selectedAgency.name} (${selectedAgency.code})` : "Not selected"}
            </p>
            <p>
              <span className="font-semibold">Jurisdiction:</span>{" "}
              {[values.countryCode, values.stateCode, values.lgaCode].filter(Boolean).join(" / ") || "-"}
            </p>
            <p><span className="font-semibold">Assigned officer:</span> {selectedAssignedUser ? `${selectedAssignedUser.displayName} (${selectedAssignedUser.role})` : "Assign later"}</p>
            <p>
              <span className="font-semibold">Assigned unit:</span>{" "}
              {selectedUnit ? `${selectedUnit.name} (${selectedUnit.unitIdentifier})` : "None"}
            </p>
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
          <Button onClick={goNext} disabled={step === 1 && (registryLoading || agencyStepBlocked || Boolean(registryError))}>
            Next
          </Button>
        ) : (
          <Button onClick={() => void handleCreate()} disabled={submitting}>
            {submitting ? "Creating…" : "Create field device"}
          </Button>
        )}
      </div>
    </Panel>
  );
}
