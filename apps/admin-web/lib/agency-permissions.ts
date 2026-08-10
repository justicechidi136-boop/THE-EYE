import type { AdminSession } from "./types/admin-views";

export function canManageAgencies(session: AdminSession | null): boolean {
  return Boolean(session?.permissions?.includes("agency:manage"));
}
