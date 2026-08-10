"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_PROFILE_ASSIGNABLE_PERMISSIONS, FieldActivationPolicy, FieldOperationalRole } from "@the-eye/shared";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import type {
  FieldDeviceView,
  FieldPermissionEffectivePreviewView,
  FieldPermissionProfileView,
} from "../../lib/types/admin-views";
import { PermissionGroupPicker } from "./permission-group-picker";
import { PermissionSummaryList } from "./permission-summary-list";

type FieldDeviceProvisioningPanelProps = {
  device: FieldDeviceView;
  canManage: boolean;
};

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function FieldDeviceProvisioningPanel({ device, canManage }: FieldDeviceProvisioningPanelProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<FieldPermissionProfileView[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [permissionProfileId, setPermissionProfileId] = useState(device.permissionProfileId ?? "");
  const [operationalRole, setOperationalRole] = useState(device.operationalRole ?? "");
  const [assignedTeamId, setAssignedTeamId] = useState(device.assignedTeamId ?? "");
  const [deviceMode, setDeviceMode] = useState(device.deviceMode ?? "standard");
  const [activationPolicy, setActivationPolicy] = useState<string>(device.activationPolicy ?? FieldActivationPolicy.RequireSupervisorFinalApproval);
  const [activationExpiresAt, setActivationExpiresAt] = useState(toDateTimeLocal(device.activationExpiresAt));
  const [reviewAt, setReviewAt] = useState(toDateTimeLocal(device.reviewAt));
  const [notes, setNotes] = useState(device.notes ?? "");
  const [inventoryAssetRef, setInventoryAssetRef] = useState(device.inventoryAssetRef ?? "");
  const [overrides, setOverrides] = useState<string[]>(device.permissionOverrides);
  const [denies, setDenies] = useState<string[]>(device.permissionDenies);
  const [preview, setPreview] = useState<FieldPermissionEffectivePreviewView | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/field-permission-profiles?isActive=true");
        const payload = (await response.json()) as { data?: FieldPermissionProfileView[] };
        if (!cancelled) setProfiles(payload.data ?? []);
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === permissionProfileId) ?? null, [profiles, permissionProfileId]);
  const overridesCatalog = useMemo(
    () => FIELD_PROFILE_ASSIGNABLE_PERMISSIONS.filter((code) => !(selectedProfile?.permissions ?? []).includes(code)),
    [selectedProfile],
  );
  const deniesCatalog = useMemo(() => selectedProfile?.permissions ?? [], [selectedProfile]);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (permissionProfileId) params.set("profileId", permissionProfileId);
        if (overrides.length) params.set("overrides", overrides.join(","));
        if (denies.length) params.set("denies", denies.join(","));
        const response = await fetch(`/api/admin/field-permissions/effective-preview?${params.toString()}`);
        const payload = (await response.json()) as { data?: FieldPermissionEffectivePreviewView };
        if (!cancelled) setPreview(payload.data ?? null);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permissionProfileId, overrides, denies]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/field-devices/${encodeURIComponent(device.id)}/provisioning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissionProfileId: permissionProfileId || null,
          operationalRole: operationalRole || undefined,
          assignedTeamId: assignedTeamId.trim() || null,
          deviceMode: deviceMode || null,
          activationPolicy: activationPolicy || undefined,
          activationExpiresAt: toIsoOrNull(activationExpiresAt),
          reviewAt: toIsoOrNull(reviewAt),
          notes: notes.trim() || null,
          inventoryAssetRef: inventoryAssetRef.trim() || null,
          permissionOverrides: overrides,
          permissionDenies: denies,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update provisioning");
      setMessage("Provisioning updated (audited).");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update provisioning");
    } finally {
      setSaving(false);
    }
  }

  const readOnlySummary = (
    <div className="grid gap-2 text-sm md:grid-cols-2">
      <p><span className="font-semibold">Provisioning mode:</span> {device.provisioningMode}</p>
      <p><span className="font-semibold">Provisioning status:</span> {device.preProvisionStatus ?? "-"}</p>
      <p><span className="font-semibold">Provisioned at:</span> {device.provisionedAt ?? "-"}</p>
      <p><span className="font-semibold">Bound to a device:</span> {device.isBound ? "Yes" : "No"}</p>
    </div>
  );

  if (!canManage) {
    return (
      <div className="grid gap-4">
        {readOnlySummary}
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Effective permissions</p>
          {previewLoading ? <p className="text-sm text-muted">Calculating…</p> : <PermissionSummaryList codes={preview?.effectivePermissions ?? []} />}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {readOnlySummary}

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Permission profile" htmlFor="prov-profile">
          <SelectInput
            id="prov-profile"
            value={permissionProfileId}
            disabled={profilesLoading}
            onChange={(event) => setPermissionProfileId(event.target.value)}
          >
            <option value="">None</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.code})
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Operational role" htmlFor="prov-role">
          <SelectInput id="prov-role" value={operationalRole} onChange={(event) => setOperationalRole(event.target.value)}>
            <option value="">Not set</option>
            {Object.values(FieldOperationalRole).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Assigned team ID" htmlFor="prov-team">
          <TextInput id="prov-team" value={assignedTeamId} onChange={(event) => setAssignedTeamId(event.target.value)} />
        </FormField>
        <FormField label="Device mode" htmlFor="prov-device-mode">
          <SelectInput id="prov-device-mode" value={deviceMode} onChange={(event) => setDeviceMode(event.target.value)}>
            <option value="standard">Standard</option>
            <option value="launcher">Launcher</option>
            <option value="managed_kiosk">Managed kiosk</option>
          </SelectInput>
        </FormField>
        <FormField label="Activation policy" htmlFor="prov-activation-policy">
          <SelectInput id="prov-activation-policy" value={activationPolicy} onChange={(event) => setActivationPolicy(event.target.value)}>
            <option value={FieldActivationPolicy.RequireSupervisorFinalApproval}>Require supervisor final approval</option>
            <option value={FieldActivationPolicy.AutoActivateOnPairing}>Auto-activate on pairing</option>
          </SelectInput>
        </FormField>
        <FormField label="Activation expires at" htmlFor="prov-activation-expiry">
          <TextInput id="prov-activation-expiry" type="datetime-local" value={activationExpiresAt} onChange={(event) => setActivationExpiresAt(event.target.value)} />
        </FormField>
        <FormField label="Review by" htmlFor="prov-review-at">
          <TextInput id="prov-review-at" type="datetime-local" value={reviewAt} onChange={(event) => setReviewAt(event.target.value)} />
        </FormField>
        <FormField label="Inventory asset reference" htmlFor="prov-inventory-ref">
          <TextInput id="prov-inventory-ref" value={inventoryAssetRef} onChange={(event) => setInventoryAssetRef(event.target.value)} />
        </FormField>
      </div>
      <FormField label="Notes" htmlFor="prov-notes">
        <textarea
          id="prov-notes"
          className="min-h-[72px] rounded-md border border-line bg-surface px-3 py-2 text-sm"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Additional grants (overrides)</p>
        <PermissionGroupPicker value={overrides} onChange={setOverrides} availablePermissions={overridesCatalog} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Restrictions (denies)</p>
        <PermissionGroupPicker value={denies} onChange={setDenies} availablePermissions={deniesCatalog} emptyLabel="Select a permission profile to enable denies." />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Effective permissions preview</p>
        {previewLoading ? <p className="text-sm text-muted">Calculating…</p> : null}
        {preview && !preview.withinAuthority ? (
          <InlineAlert tone="warning">Exceeds your delegation authority: {preview.excessPermissions.join(", ")}</InlineAlert>
        ) : null}
        <PermissionSummaryList codes={preview?.effectivePermissions ?? []} />
      </div>

      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="flex justify-end">
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save provisioning"}
        </Button>
      </div>
    </div>
  );
}
