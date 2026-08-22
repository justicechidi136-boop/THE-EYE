import { BadRequestException } from "@nestjs/common";
import { BroadcastType } from "@the-eye/shared";
import { assertValidMissingPersonAge } from "../../notifications/citizen-notification-copy";

export type CreateMissingPersonBroadcastDto = {
  clientBroadcastId: string;
  fullName: string;
  ageOrApproximateAge: string;
  gender?: string;
  lastSeenAt: string;
  lastSeenLatitude: number;
  lastSeenLongitude: number;
  lastSeenAddress?: string;
  country?: string;
  state?: string;
  lga?: string;
  clothingDescription: string;
  physicalDescription: string;
  contactMethod: string;
  additionalDescription?: string;
  policeReportReference?: string;
  reporterRelationship: string;
  consentDeclaration: boolean;
  medicalVulnerability?: string;
  language?: string;
  rewardNotice?: string;
  metadata?: Record<string, unknown>;
};

export type CreateStolenVehicleBroadcastDto = {
  clientBroadcastId: string;
  vehicleType: string;
  make: string;
  model: string;
  year?: number | string;
  colour: string;
  registrationNumber: string;
  country?: string;
  state?: string;
  lga?: string;
  stolenAt: string;
  lastSeenAt?: string;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  lastKnownLocation?: string;
  distinguishingFeatures: string;
  theftDescription?: string;
  policeReportReference?: string;
  contactMethod: string;
  vinLastFour?: string;
  vin?: string;
  directionOfTravel?: string;
  rewardNotice?: string;
  metadata?: Record<string, unknown>;
};

export type CreateCitizenBroadcastCommentDto = {
  body: string;
  parentId?: string;
  isSighting?: boolean;
};

export type UpdateCitizenBroadcastCommentDto = {
  body: string;
};

export type ReactToCitizenBroadcastCommentDto = {
  reaction: "Helpful" | "Thanks";
};

export type ReportBroadcastDto = {
  reason: string;
  details?: string;
};

export type ResolveBroadcastDto = {
  note?: string;
};

export type WithdrawBroadcastDto = {
  reason?: string;
  clientResolutionId?: string;
};

export type SubmitBroadcastSightingDto = {
  clientSightingId?: string;
  observedAt?: string;
  locationMode?: "CURRENT_GPS" | "MANUAL" | "NOT_PROVIDED";
  latitude?: number;
  longitude?: number;
  approximateArea?: string;
  countryCode?: string;
  state?: string;
  cityTown?: string;
  streetAddress?: string;
  displayAddress?: string;
  capturedAt?: string;
  description: string;
  confidence?: string;
  anonymousPublic?: boolean;
  directionOfTravel?: string;
  attachments?: unknown;
};

export const BROADCAST_REPORT_REASONS = [
  "FalseOrMisleading",
  "VehicleInformationIncorrect",
  "PersonInformationIncorrect",
  "Duplicate",
  "PrivacyViolation",
  "Impersonation",
  "Spam",
  "PersonAlreadyFound",
  "VehicleAlreadyRecovered",
  "Other",
] as const;

export type BroadcastReportReason = (typeof BROADCAST_REPORT_REASONS)[number];

type TypeSpecificReportableBroadcast =
  | BroadcastType.MissingPerson
  | BroadcastType.StolenVehicle;

const BROADCAST_REPORT_REASON_CATALOG: Record<
  TypeSpecificReportableBroadcast,
  readonly BroadcastReportReason[]
> = {
  [BroadcastType.MissingPerson]: [
    "FalseOrMisleading",
    "PersonInformationIncorrect",
    "PersonAlreadyFound",
    "Duplicate",
    "Impersonation",
    "PrivacyViolation",
    "Spam",
    "Other",
  ],
  [BroadcastType.StolenVehicle]: [
    "FalseOrMisleading",
    "VehicleInformationIncorrect",
    "VehicleAlreadyRecovered",
    "Duplicate",
    "Impersonation",
    "PrivacyViolation",
    "Spam",
    "Other",
  ],
} as const;

function isTypeSpecificReportableBroadcast(
  type: BroadcastType,
): type is TypeSpecificReportableBroadcast {
  return type === BroadcastType.MissingPerson || type === BroadcastType.StolenVehicle;
}

const citizenTypes = new Set<BroadcastType>([
  BroadcastType.MissingPerson,
  BroadcastType.StolenVehicle,
]);

export function assertCitizenBroadcastType(type: BroadcastType) {
  if (!citizenTypes.has(type)) {
    throw new BadRequestException("Citizens may only create Missing Person or Stolen Vehicle broadcasts");
  }
}

export function getAllowedBroadcastReportReasons(type: BroadcastType): readonly BroadcastReportReason[] {
  return isTypeSpecificReportableBroadcast(type)
    ? BROADCAST_REPORT_REASON_CATALOG[type]
    : [];
}

export function validateBroadcastReportReason(type: BroadcastType, dto: ReportBroadcastDto) {
  const reason = dto.reason?.trim();
  if (!reason) throw new BadRequestException("Report reason is required");
  const allowedReasons = getAllowedBroadcastReportReasons(type);
  if (!allowedReasons.includes(reason as BroadcastReportReason)) {
    throw new BadRequestException("Unsupported report reason");
  }
  if (reason === "Other" && !dto.details?.trim()) {
    throw new BadRequestException("Additional details are required for Other");
  }
}

export function validateMissingPersonBroadcastDto(dto: CreateMissingPersonBroadcastDto) {
  if (!dto.clientBroadcastId?.trim()) throw new BadRequestException("clientBroadcastId is required");
  if (!dto.fullName?.trim()) throw new BadRequestException("fullName is required");
  try {
    dto.ageOrApproximateAge = assertValidMissingPersonAge(dto.ageOrApproximateAge ?? "");
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
  if (!dto.lastSeenAt) throw new BadRequestException("lastSeenAt is required");
  const lastSeen = new Date(dto.lastSeenAt);
  if (Number.isNaN(lastSeen.getTime())) throw new BadRequestException("lastSeenAt must be a valid date-time");
  if (!/[Tt ]\d{1,2}:\d{2}/.test(dto.lastSeenAt)) {
    throw new BadRequestException("lastSeenAt must include both date and time");
  }
  assertCoordinate(dto.lastSeenLatitude, "lastSeenLatitude", -90, 90);
  assertCoordinate(dto.lastSeenLongitude, "lastSeenLongitude", -180, 180);
  if (!dto.clothingDescription?.trim()) throw new BadRequestException("clothingDescription is required");
  if (!dto.physicalDescription?.trim()) throw new BadRequestException("physicalDescription is required");
  if (!dto.contactMethod?.trim()) throw new BadRequestException("contactMethod is required");
  if (!dto.reporterRelationship?.trim()) throw new BadRequestException("reporterRelationship is required");
  if (dto.consentDeclaration !== true) throw new BadRequestException("consentDeclaration must be accepted");
}

export function validateStolenVehicleBroadcastDto(dto: CreateStolenVehicleBroadcastDto) {
  if (!dto.clientBroadcastId?.trim()) throw new BadRequestException("clientBroadcastId is required");
  if (!dto.vehicleType?.trim()) throw new BadRequestException("vehicleType is required");
  if (!dto.make?.trim()) throw new BadRequestException("make is required");
  if (!dto.model?.trim()) throw new BadRequestException("model is required");
  if (!dto.colour?.trim()) throw new BadRequestException("colour is required");
  if (!dto.registrationNumber?.trim()) throw new BadRequestException("registrationNumber is required");
  if (dto.vin != null && dto.vin.trim().length > 64) {
    throw new BadRequestException("vin or chassis number must be 64 characters or fewer");
  }
  if (!dto.stolenAt) throw new BadRequestException("stolenAt is required");
  if (!dto.lastSeenAt) throw new BadRequestException("lastSeenAt is required");
  const lastSeen = new Date(dto.lastSeenAt);
  if (Number.isNaN(lastSeen.getTime())) throw new BadRequestException("lastSeenAt must be a valid date-time");
  if (!/[Tt ]\d{1,2}:\d{2}/.test(dto.lastSeenAt)) {
    throw new BadRequestException("lastSeenAt must include both date and time");
  }
  if (!dto.lastKnownLocation?.trim()) throw new BadRequestException("lastKnownLocation is required");
  if (!dto.distinguishingFeatures?.trim()) throw new BadRequestException("distinguishingFeatures is required");
  if (!dto.theftDescription?.trim()) throw new BadRequestException("theftDescription is required");
  if (!dto.contactMethod?.trim()) throw new BadRequestException("contactMethod is required");
  if (dto.year !== undefined && dto.year !== null && `${dto.year}`.trim().length > 0) {
    const parsedYear = Number.parseInt(`${dto.year}`, 10);
    if (!Number.isFinite(parsedYear) || parsedYear < 1886 || parsedYear > 3000) {
      throw new BadRequestException("year must be a valid vehicle year");
    }
  }
  if (dto.lastKnownLatitude !== undefined) {
    assertCoordinate(dto.lastKnownLatitude, "lastKnownLatitude", -90, 90);
  }
  if (dto.lastKnownLongitude !== undefined) {
    assertCoordinate(dto.lastKnownLongitude, "lastKnownLongitude", -180, 180);
  }
}

export function maskRegistrationNumber(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}
