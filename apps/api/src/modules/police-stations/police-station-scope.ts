import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";

export const GOOGLE_ONLY_SOURCE_MARKERS = ["google places", "google maps", "google_places", "places api"];

export const DUPLICATE_PROXIMITY_METERS = 150;

export type JurisdictionRecord = {
  id: string;
  country: string;
  state: string;
  lga: string;
};

export function normalizePhone(phone?: string | null): string | undefined {
  if (!phone?.trim()) return undefined;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length < 7) throw new BadRequestException("Phone number is too short");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  return `+${digits}`;
}

export function sanitizeSourceReference(value?: string | null): string {
  if (!value?.trim()) throw new BadRequestException("sourceReference is required");
  const trimmed = value.trim();
  if (/<script|javascript:|data:/i.test(trimmed)) {
    throw new BadRequestException("sourceReference contains unsafe content");
  }
  if (trimmed.length > 500) throw new BadRequestException("sourceReference is too long");
  return trimmed;
}

export function sanitizeSource(value?: string | null): string {
  if (!value?.trim()) throw new BadRequestException("source is required");
  return value.trim();
}

export function assertSourceNotGoogleOnlyForOfficialVerification(source: string, verificationStatus: string) {
  if (verificationStatus !== "VerifiedOfficial") return;
  const lower = source.toLowerCase();
  if (GOOGLE_ONLY_SOURCE_MARKERS.some((marker) => lower.includes(marker))) {
    throw new BadRequestException(
      "Google Places results cannot be marked VerifiedOfficial without an independent official source",
    );
  }
}

export function assertActorCanManagePolice(actor: JwtPayload) {
  if (actor.typ !== "admin") throw new ForbiddenException("Admin access required");
  const allowed: string[] = [AdminRoleName.SuperAdmin, AdminRoleName.CountryAdmin, AdminRoleName.StateAdmin];
  if (!actor.role || !allowed.includes(actor.role)) {
    throw new ForbiddenException("Insufficient permissions to manage police stations");
  }
}

export function assertJurisdictionScope(actor: JwtPayload, jurisdiction: JurisdictionRecord) {
  assertActorCanManagePolice(actor);
  if (actor.role === AdminRoleName.SuperAdmin) return;
  if (actor.role === AdminRoleName.CountryAdmin) {
    if (actor.country && jurisdiction.country.toLowerCase() !== actor.country.toLowerCase()) {
      throw new ForbiddenException("Country Admin cannot manage stations outside assigned country");
    }
    return;
  }
  if (actor.role === AdminRoleName.StateAdmin) {
    if (actor.country && jurisdiction.country.toLowerCase() !== actor.country.toLowerCase()) {
      throw new ForbiddenException("State Admin cannot manage stations outside assigned state");
    }
    if (actor.state && jurisdiction.state.toLowerCase() !== actor.state.toLowerCase()) {
      throw new ForbiddenException("State Admin cannot manage stations outside assigned state");
    }
  }
}

export function normalizeStationName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s]/g, "");
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}
