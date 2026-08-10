import { FIELD_PERMISSION_GROUPS } from "@the-eye/shared";

export type PermissionGroupSummary = {
  key: string;
  label: string;
  description: string;
  codes: string[];
};

/**
 * Groups a flat list of permission codes back into their human-readable catalog groups so
 * read-only summaries (profile detail, device effective-permissions, wizard review) can lead
 * with labels/descriptions instead of raw technical codes.
 */
export function summarizePermissionsByGroup(codes: readonly string[]): {
  groups: PermissionGroupSummary[];
  ungrouped: string[];
} {
  const codeSet = new Set(codes);
  const groups: PermissionGroupSummary[] = [];
  const matched = new Set<string>();
  for (const [key, group] of Object.entries(FIELD_PERMISSION_GROUPS)) {
    const matchedCodes = group.permissions.filter((code) => codeSet.has(code));
    if (matchedCodes.length) {
      groups.push({ key, label: group.label, description: group.description, codes: matchedCodes });
      for (const code of matchedCodes) matched.add(code);
    }
  }
  const ungrouped = codes.filter((code) => !matched.has(code));
  return { groups, ungrouped };
}
