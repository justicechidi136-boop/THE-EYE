"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_PROFILE_ASSIGNABLE_PERMISSIONS, FieldOperationalRole } from "@the-eye/shared";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import type { FieldPermissionEffectivePreviewView, FieldPermissionProfileView } from "../../lib/types/admin-views";
import { PermissionGroupPicker } from "./permission-group-picker";

type FieldPermissionProfileFormProps = {
  mode: "create" | "edit";
  profile?: FieldPermissionProfileView;
};

const CODE_PATTERN = /^[a-z][a-z0-9_-]{2,63}$/;

export function FieldPermissionProfileForm({ mode, profile }: FieldPermissionProfileFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(profile?.code ?? "");
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [operationalRole, setOperationalRole] = useState(profile?.operationalRole ?? "");
  const [permissions, setPermissions] = useState<string[]>(profile?.permissions ?? []);
  const [actorCeiling, setActorCeiling] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isReadOnly = mode === "edit" && Boolean(profile?.isSystem);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/field-permissions/effective-preview");
        const payload = (await response.json()) as { data?: FieldPermissionEffectivePreviewView };
        if (!cancelled) setActorCeiling(payload.data?.actorCeiling ?? null);
      } catch {
        // Non-fatal: ceiling is a UX hint only, server re-validates on submit.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const disabledPermissions = useMemo(
    () => (actorCeiling ? FIELD_PROFILE_ASSIGNABLE_PERMISSIONS.filter((permission) => !actorCeiling.includes(permission)) : []),
    [actorCeiling],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === "create") {
      if (!CODE_PATTERN.test(code.trim())) {
        setError("Code must be lowercase, start with a letter, and use letters/numbers/underscore/hyphen (3-64 chars).");
        return;
      }
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!permissions.length) {
      setError("Select at least one permission.");
      return;
    }

    setSubmitting(true);
    try {
      const path = mode === "create" ? "/api/admin/field-permission-profiles" : `/api/admin/field-permission-profiles/${encodeURIComponent(profile?.id ?? "")}`;
      const body =
        mode === "create"
          ? { code: code.trim(), name: name.trim(), description: description.trim() || undefined, operationalRole: operationalRole || undefined, permissions }
          : { name: name.trim(), description: description.trim() || undefined, operationalRole: operationalRole || undefined, permissions };
      const response = await fetch(path, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { data?: { id?: string }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to save permission profile");
      setMessage(mode === "create" ? "Permission profile created." : "Permission profile updated.");
      const id = payload.data?.id ?? profile?.id;
      if (id) {
        router.push(`/field-operations/permission-profiles/${id}`);
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save permission profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      {isReadOnly ? <InlineAlert tone="info">System profiles are read-only and cannot be edited.</InlineAlert> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Code" htmlFor="profile-code" hint={mode === "create" ? "Lowercase slug, e.g. patrol-officer-standard. Cannot be changed later." : undefined}>
          <TextInput
            id="profile-code"
            value={code}
            disabled={mode === "edit"}
            onChange={(event) => setCode(event.target.value.toLowerCase())}
            placeholder="patrol-officer-standard"
          />
        </FormField>
        <FormField label="Name" htmlFor="profile-name">
          <TextInput id="profile-name" value={name} disabled={isReadOnly} onChange={(event) => setName(event.target.value)} placeholder="Patrol Officer — Standard" />
        </FormField>
        <FormField label="Operational role" htmlFor="profile-role">
          <SelectInput id="profile-role" value={operationalRole} disabled={isReadOnly} onChange={(event) => setOperationalRole(event.target.value)}>
            <option value="">Not set</option>
            {Object.values(FieldOperationalRole).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>
      <FormField label="Description" htmlFor="profile-description">
        <textarea
          id="profile-description"
          className="min-h-[72px] rounded-md border border-line bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          value={description}
          disabled={isReadOnly}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Permissions granted by this profile</p>
        <p className="mb-2 text-xs text-muted">
          Selections are limited to the field-permission catalog — free-text permission strings are not accepted.
        </p>
        <PermissionGroupPicker
          value={permissions}
          onChange={setPermissions}
          availablePermissions={FIELD_PROFILE_ASSIGNABLE_PERMISSIONS}
          disabledPermissions={disabledPermissions}
          disabled={isReadOnly}
        />
      </div>

      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {!isReadOnly ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : mode === "create" ? "Create profile" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
