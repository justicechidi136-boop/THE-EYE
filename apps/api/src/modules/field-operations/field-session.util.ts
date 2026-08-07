import { ForbiddenException } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";

export type FieldSessionContext = {
  officerId: string;
  fieldDeviceId: string;
  agencyId?: string;
  assignedUnitId?: string;
  jurisdictionId?: string;
  country?: string;
  state?: string;
  lga?: string;
  fieldRole?: string;
};

export function assertFieldSession(actor: JwtPayload): FieldSessionContext {
  if (actor.typ !== "field" || !actor.fieldDeviceId) {
    throw new ForbiddenException("Active field device session required");
  }
  return {
    officerId: actor.sub,
    fieldDeviceId: actor.fieldDeviceId,
    agencyId: actor.agencyId,
    assignedUnitId: actor.assignedUnitId,
    jurisdictionId: actor.jurisdictionId,
    country: actor.country,
    state: actor.state,
    lga: actor.lga,
    fieldRole: actor.fieldRole,
  };
}

export function decimalOrNull(value?: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

export function resolvePageLimit(limit?: string, fallback = 50, max = 200) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}
