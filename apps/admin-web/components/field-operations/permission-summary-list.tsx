import { summarizePermissionsByGroup } from "../../lib/field-permission-display";

/** Read-only, human-readable rendering of a permission set, grouped by catalog with codes collapsed behind a disclosure. */
export function PermissionSummaryList({ codes, emptyLabel = "No permissions granted." }: { codes: string[]; emptyLabel?: string }) {
  if (!codes.length) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  const { groups, ungrouped } = summarizePermissionsByGroup(codes);
  return (
    <div className="grid gap-2">
      {groups.map((group) => (
        <div key={group.key} className="rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <p className="font-semibold text-ink">{group.label}</p>
          <p className="text-xs text-muted">{group.description}</p>
          <details className="mt-1">
            <summary className="cursor-pointer text-xs font-medium text-eye hover:underline">
              {group.codes.length} technical code{group.codes.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-1 grid gap-0.5">
              {group.codes.map((code) => (
                <li key={code}>
                  <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">{code}</code>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
      {ungrouped.length ? (
        <div className="rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <p className="font-semibold text-ink">Other</p>
          <ul className="mt-1 grid gap-0.5">
            {ungrouped.map((code) => (
              <li key={code}>
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">{code}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
