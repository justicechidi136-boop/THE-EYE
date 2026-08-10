"use client";

import { useMemo, useState } from "react";
import { FIELD_PERMISSION_GROUPS, type FieldPermissionGroup } from "@the-eye/shared";

type PermissionGroupPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Restrict selectable/visible codes to this catalog (e.g. profile-assignable permissions). */
  availablePermissions?: string[];
  /** Codes that are shown but cannot be toggled (e.g. outside the actor's delegation ceiling). */
  disabledPermissions?: string[];
  disabled?: boolean;
  emptyLabel?: string;
};

type GroupEntry = { key: string; group: FieldPermissionGroup; codes: string[] };

/**
 * Renders human-readable permission groups (from the shared field permission catalog) as the
 * primary selection unit, with the underlying technical permission codes available behind an
 * expandable "Show technical codes" disclosure. Never accepts free-text permission strings.
 */
export function PermissionGroupPicker({
  value,
  onChange,
  availablePermissions,
  disabledPermissions,
  disabled = false,
  emptyLabel = "No permissions available to assign.",
}: PermissionGroupPickerProps) {
  const selectedSet = useMemo(() => new Set(value), [value]);
  const availableSet = useMemo(() => (availablePermissions ? new Set(availablePermissions) : null), [availablePermissions]);
  const disabledSet = useMemo(() => new Set(disabledPermissions ?? []), [disabledPermissions]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function togglePermission(code: string) {
    if (disabled || disabledSet.has(code)) return;
    const next = selectedSet.has(code) ? value.filter((item) => item !== code) : [...value, code];
    onChange(next);
  }

  function toggleGroup(codes: string[], allSelected: boolean) {
    if (disabled) return;
    const eligible = codes.filter((code) => !disabledSet.has(code));
    if (allSelected) {
      onChange(value.filter((item) => !eligible.includes(item)));
    } else {
      const merged = new Set(value);
      for (const code of eligible) merged.add(code);
      onChange(Array.from(merged));
    }
  }

  const groups: GroupEntry[] = Object.entries(FIELD_PERMISSION_GROUPS)
    .map(([key, group]) => {
      const codes: string[] = availableSet ? group.permissions.filter((code) => availableSet.has(code)) : group.permissions;
      return { key, group, codes };
    })
    .filter((entry) => entry.codes.length > 0);

  if (!groups.length) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="grid gap-3">
      {groups.map(({ key, group, codes }) => {
        const selectedCount = codes.filter((code) => selectedSet.has(code)).length;
        const allSelected = selectedCount === codes.length;
        const someSelected = selectedCount > 0 && !allSelected;
        const groupDisabled = disabled || codes.every((code) => disabledSet.has(code));
        const isExpanded = expanded[key] ?? false;
        return (
          <div key={key} className="rounded-md border border-line bg-surfaceMuted p-3">
            <div className="flex items-start justify-between gap-3">
              <label className="flex flex-1 items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  disabled={groupDisabled}
                  onChange={() => toggleGroup(codes, allSelected)}
                />
                <span>
                  <span className="block font-semibold text-ink">{group.label}</span>
                  <span className="block text-xs text-muted">{group.description}</span>
                </span>
              </label>
              <span className="whitespace-nowrap text-xs font-medium text-muted">
                {selectedCount}/{codes.length}
              </span>
            </div>
            <details
              className="mt-2 pl-6"
              open={isExpanded}
              onToggle={(event) => setExpanded((current) => ({ ...current, [key]: (event.target as HTMLDetailsElement).open }))}
            >
              <summary className="cursor-pointer text-xs font-medium text-eye hover:underline">
                {isExpanded ? "Hide technical codes" : "Show technical codes"}
              </summary>
              <div className="mt-2 grid gap-1.5">
                {codes.map((code) => (
                  <label key={code} className={`flex items-center gap-2 text-xs ${disabledSet.has(code) ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(code)}
                      disabled={disabled || disabledSet.has(code)}
                      onChange={() => togglePermission(code)}
                    />
                    <code className="rounded bg-surface px-1 py-0.5 font-mono">{code}</code>
                    {disabledSet.has(code) ? <span className="text-danger">outside delegation ceiling</span> : null}
                  </label>
                ))}
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
