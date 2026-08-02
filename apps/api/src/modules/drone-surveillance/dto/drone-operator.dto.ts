import { BadRequestException } from "@nestjs/common";
import {
  DroneCertificationType,
  DroneEmploymentType,
  DroneMissionAssignmentRole,
  DroneOperatorAccountStatus,
  DroneOperatorAvailability,
  DroneOperatorDocumentType,
  DroneOperatorRole,
  DroneQualificationLevel,
  DroneSafetyRecordType,
  DroneVerificationStatus,
} from "@the-eye/shared";

export type OperatorListQuery = {
  cursor?: string;
  limit?: string | number;
  q?: string;
  operatorCode?: string;
  country?: string;
  state?: string;
  lga?: string;
  agencyId?: string;
  operatingBase?: string;
  operatorRole?: string;
  availability?: string;
  accountStatus?: string;
  licenceStatus?: string;
  certification?: string;
  droneQualification?: string;
  activeMission?: string;
};

export type CreateDroneOperatorInput = {
  operatorCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  lga?: string;
  operatingAddress?: string;
  employmentType?: string;
  assignedAgencyId?: string;
  assignedOperatingBase?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  callsign?: string;
  operatorRole?: string;
  adminUserId?: string;
  maximumConcurrentMissions?: number;
  emergencyCallAvailable?: boolean;
};

export type UpdateDroneOperatorInput = Partial<Omit<CreateDroneOperatorInput, "operatorCode">> & {
  operatorCode?: string;
};

export type OperatorStatusInput = {
  accountStatus?: string;
  availabilityStatus?: string;
  reason?: string;
};

export type VerificationActionInput = {
  action: "approve" | "reject" | "request_correction" | "suspend";
  notes: string;
};

export type CreateLicenceInput = {
  licenceNumber: string;
  licenceCategory: string;
  issuingAuthority: string;
  issueDate?: string;
  expiryDate?: string;
  documentObjectKey?: string;
  documentMimeType?: string;
  documentChecksum?: string;
};

export type UpdateLicenceInput = Partial<CreateLicenceInput>;

export type CreateCertificationInput = {
  certificationType: string;
  trainingProvider?: string;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  documentObjectKey?: string;
};

export type UpdateCertificationInput = Partial<CreateCertificationInput>;

export type CreateQualificationInput = {
  droneDeviceId?: string;
  droneModel?: string;
  qualificationLevel?: string;
  qualifiedAt?: string;
  expiresAt?: string;
  notes?: string;
};

export type UpdateQualificationInput = Partial<CreateQualificationInput & { status?: string }>;

export type DocumentPresignInput = {
  documentType: string;
  fileName: string;
  contentType: string;
  sizeBytes?: number;
};

export type DocumentConfirmInput = {
  documentType: string;
  title: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  checksum?: string;
  sizeBytes?: number;
};

export type CreateSafetyRecordInput = {
  recordType: string;
  title: string;
  description?: string;
  missionId?: string;
  severity?: string;
  restricted?: boolean;
  metadata?: Record<string, unknown>;
};

export type MissionAssignmentInput = {
  missionId: string;
  operatorId: string;
  assignmentRole?: string;
  idempotencyKey?: string;
};

export type AssignmentResponseInput = {
  action: "accept" | "decline";
  reason?: string;
  version?: number;
};

export type SuitableOperatorsQuery = {
  missionId: string;
  droneId?: string;
  limit?: string | number;
};

export type PreflightCheckInput = {
  requiredCertifications?: string[];
  geofenceReviewed?: boolean;
  noFlyZonesReviewed?: boolean;
  weatherCheckRecorded?: boolean;
  emergencyOverride?: boolean;
  overrideReason?: string;
};

function assertText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required`);
}

function assertEnum(value: string | undefined, allowed: string[], field: string) {
  if (value && !allowed.includes(value)) throw new BadRequestException(`Invalid ${field}`);
}

export function validateCreateDroneOperatorInput(dto: CreateDroneOperatorInput) {
  assertText(dto.operatorCode, "operatorCode");
  assertText(dto.fullName, "fullName");
  assertEnum(dto.employmentType, Object.values(DroneEmploymentType), "employmentType");
  assertEnum(dto.operatorRole, Object.values(DroneOperatorRole), "operatorRole");
  if (dto.maximumConcurrentMissions !== undefined && (dto.maximumConcurrentMissions < 1 || dto.maximumConcurrentMissions > 5)) {
    throw new BadRequestException("maximumConcurrentMissions must be between 1 and 5");
  }
}

export function validateOperatorStatusInput(dto: OperatorStatusInput) {
  if (!dto.accountStatus && !dto.availabilityStatus) {
    throw new BadRequestException("accountStatus or availabilityStatus is required");
  }
  if (dto.accountStatus) assertEnum(dto.accountStatus, Object.values(DroneOperatorAccountStatus), "accountStatus");
  if (dto.availabilityStatus) assertEnum(dto.availabilityStatus, Object.values(DroneOperatorAvailability), "availabilityStatus");
}

export function validateVerificationActionInput(dto: VerificationActionInput) {
  assertText(dto.notes, "notes");
  if (!["approve", "reject", "request_correction", "suspend"].includes(dto.action)) {
    throw new BadRequestException("Invalid verification action");
  }
}

export function validateCreateLicenceInput(dto: CreateLicenceInput) {
  assertText(dto.licenceNumber, "licenceNumber");
  assertText(dto.licenceCategory, "licenceCategory");
  assertText(dto.issuingAuthority, "issuingAuthority");
}

export function validateCreateCertificationInput(dto: CreateCertificationInput) {
  assertText(dto.certificationType, "certificationType");
  assertEnum(dto.certificationType, Object.values(DroneCertificationType), "certificationType");
}

export function validateCreateQualificationInput(dto: CreateQualificationInput) {
  if (!dto.droneDeviceId && !dto.droneModel) {
    throw new BadRequestException("droneDeviceId or droneModel is required");
  }
  assertEnum(dto.qualificationLevel ?? "Trainee", Object.values(DroneQualificationLevel), "qualificationLevel");
}

export function validateDocumentPresignInput(dto: DocumentPresignInput) {
  assertText(dto.documentType, "documentType");
  assertText(dto.fileName, "fileName");
  assertText(dto.contentType, "contentType");
  assertEnum(dto.documentType, Object.values(DroneOperatorDocumentType), "documentType");
}

export function validateDocumentConfirmInput(dto: DocumentConfirmInput) {
  assertText(dto.documentType, "documentType");
  assertText(dto.title, "title");
  assertText(dto.bucket, "bucket");
  assertText(dto.objectKey, "objectKey");
  assertText(dto.mimeType, "mimeType");
}

export function validateCreateSafetyRecordInput(dto: CreateSafetyRecordInput) {
  assertText(dto.recordType, "recordType");
  assertText(dto.title, "title");
  assertEnum(dto.recordType, Object.values(DroneSafetyRecordType), "recordType");
}

export function validateMissionAssignmentInput(dto: MissionAssignmentInput) {
  assertText(dto.missionId, "missionId");
  assertText(dto.operatorId, "operatorId");
  assertEnum(dto.assignmentRole ?? "Primary", Object.values(DroneMissionAssignmentRole), "assignmentRole");
}

export function validateAssignmentResponseInput(dto: AssignmentResponseInput) {
  if (!["accept", "decline"].includes(dto.action)) throw new BadRequestException("Invalid assignment action");
  if (dto.action === "decline") assertText(dto.reason, "reason");
}

export function validatePreflightCheckInput(dto: PreflightCheckInput) {
  if (dto.emergencyOverride && !dto.overrideReason?.trim()) {
    throw new BadRequestException("overrideReason is required for emergency override");
  }
}

export function restrictedDocumentTypes() {
  return new Set([
    DroneOperatorDocumentType.GovernmentId,
    DroneOperatorDocumentType.SecurityClearance,
    DroneOperatorDocumentType.MedicalClearance,
    DroneOperatorDocumentType.DisciplinaryRecord,
  ]);
}

export function mapVerificationActionToStatus(action: VerificationActionInput["action"]) {
  switch (action) {
    case "approve":
      return DroneVerificationStatus.Verified;
    case "reject":
      return DroneVerificationStatus.Rejected;
    case "request_correction":
      return DroneVerificationStatus.PendingReview;
    case "suspend":
      return DroneVerificationStatus.Suspended;
    default:
      throw new BadRequestException("Invalid verification action");
  }
}
