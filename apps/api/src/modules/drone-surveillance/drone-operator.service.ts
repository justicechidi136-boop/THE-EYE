import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AdminRoleName, DroneMissionAssignmentStatus, DroneOperatorAccountStatus, DroneOperatorAvailability, DroneVerificationStatus } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { adminCanAccessGeography, adminGeographyWhere } from "../../common/auth/admin-geography-scope";
import { buildCursorPage, dateIdCursorWhere, decodeDateIdCursor, encodeDateIdCursor, resolvePageLimit } from "../../common/pagination/cursor-pagination";
import { buildBullJobId } from "../../common/queue/bull-job-id";
import { assertDroneOperatorDocumentObjectKey, createS3PresignedGetUrl, createS3PresignedPutUrl, droneOperatorDocumentObjectKey } from "../../common/storage/s3-presign";
import { isValidPhoneNumber, normalizePhoneNumber } from "../auth/phone-normalize";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { assertAccountStatusAllowsAssignment, assertAvailabilityTransition } from "./drone-operator-availability";
import { expiryWarningLevel, isLicenceValid, isQualificationValidForDrone, runOperatorAssignmentChecks, runPreflightChecks } from "./drone-operator-compliance";
import type { AssignmentResponseInput, CreateCertificationInput, CreateDroneOperatorInput, CreateLicenceInput, CreateQualificationInput, CreateSafetyRecordInput, DocumentConfirmInput, DocumentPresignInput, MissionAssignmentInput, OperatorListQuery, OperatorStatusInput, PreflightCheckInput, SuitableOperatorsQuery, UpdateCertificationInput, UpdateDroneOperatorInput, UpdateLicenceInput, UpdateQualificationInput, VerificationActionInput } from "./dto/drone-operator.dto";
import { mapVerificationActionToStatus, restrictedDocumentTypes, validateAssignmentResponseInput, validateCreateCertificationInput, validateCreateDroneOperatorInput, validateCreateLicenceInput, validateCreateQualificationInput, validateCreateSafetyRecordInput, validateDocumentConfirmInput, validateDocumentPresignInput, validateMissionAssignmentInput, validateOperatorStatusInput, validatePreflightCheckInput, validateVerificationActionInput } from "./dto/drone-operator.dto";

const E = {
  operator: "drone_operators",
  licence: "drone_operator_licences",
  cert: "drone_operator_certifications",
  qualification: "drone_operator_qualifications",
  document: "drone_operator_documents",
  safety: "drone_operator_safety_records",
  assignment: "drone_mission_assignments",
  preflight: "drone_mission_preflight_checks",
} as const;

@Injectable()
export class DroneOperatorService {
  private readonly prismaAny: any;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {
    this.prismaAny = this.prisma as any;
  }

  async listOperators(query: OperatorListQuery, actor: JwtPayload) {
    this.assertOperatorRead(actor);
    const limit = resolvePageLimit(query.limit, 25);
    const cursor = decodeDateIdCursor(query.cursor);
    if (query.cursor && !cursor) throw new BadRequestException("Invalid cursor");
    const where = this.buildOperatorWhere(query, actor, cursor);
    const whereNoCursor = this.buildOperatorWhere(query, actor, null);
    const now = new Date();
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [rows, total, available, onMission, pendingVerification, expiredLicences, certsExpiring30d, suspended] = await Promise.all([
      this.prismaAny.droneOperator.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        include: {
          licences: { select: { expiryDate: true, verificationStatus: true }, take: 5, orderBy: { createdAt: "desc" } },
          missionAssignments: { where: { status: { in: [DroneMissionAssignmentStatus.Pending, DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active] } }, select: { id: true } },
        },
      }),
      this.prismaAny.droneOperator.count({ where: whereNoCursor }),
      this.prismaAny.droneOperator.count({ where: { ...whereNoCursor, availabilityStatus: DroneOperatorAvailability.Available } }),
      this.prismaAny.droneOperator.count({ where: { ...whereNoCursor, availabilityStatus: DroneOperatorAvailability.OnMission } }),
      this.prismaAny.droneOperator.count({ where: { ...whereNoCursor, accountStatus: DroneOperatorAccountStatus.PendingReview } }),
      this.prismaAny.droneOperator.count({ where: { ...whereNoCursor, licences: { some: { OR: [{ expiryDate: { lt: now } }, { verificationStatus: { not: DroneVerificationStatus.Verified } }] } } } }),
      this.prismaAny.droneOperator.count({ where: { ...whereNoCursor, certifications: { some: { verificationStatus: DroneVerificationStatus.Verified, expiryDate: { gte: now, lte: in30d } } } } }),
      this.prismaAny.droneOperator.count({ where: { ...whereNoCursor, OR: [{ accountStatus: DroneOperatorAccountStatus.Suspended }, { availabilityStatus: DroneOperatorAvailability.Suspended }] } }),
    ]);

    const page = buildCursorPage(rows, limit, (it) => encodeDateIdCursor(it.createdAt, it.id));
    return {
      ...page,
      data: page.data.map((it: any) => this.mapOperatorListItem(it, actor)),
      stats: { total, available, onMission, pendingVerification, expiredLicences, certsExpiring30d, suspended },
    };
  }

  async getOperator(id: string, actor: JwtPayload) {
    const operator = await this.prismaAny.droneOperator.findUnique({
      where: { id },
      include: {
        assignedAgency: { select: { id: true, name: true } },
        licences: { orderBy: { createdAt: "desc" } },
        certifications: { orderBy: { createdAt: "desc" } },
        qualifications: { include: { droneDevice: { select: { id: true, deviceId: true, model: true } } }, orderBy: { createdAt: "desc" } },
        missionAssignments: { include: { mission: { select: { id: true, missionCode: true, title: true, status: true, priority: true, scheduledAt: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    if (!operator) throw new NotFoundException("Drone operator not found");
    this.assertOperatorAccess(operator, actor);
    const [missionStats, safetySummary] = await Promise.all([this.buildMissionStats(operator.id), this.buildSafetySummary(operator.id)]);
    const currentAssignment = operator.missionAssignments.find((a: any) => [DroneMissionAssignmentStatus.Pending, DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active].includes(a.status)) ?? null;
    return {
      data: {
        ...this.mapOperatorDetail(operator, actor),
        missionStats,
        currentAssignment,
        safetySummary,
        complianceSummary: {
          licenceCount: operator.licences.length,
          validLicences: operator.licences.filter((l: any) => isLicenceValid(l)).length,
          certificationCount: operator.certifications.length,
          validCertifications: operator.certifications.filter((c: any) => c.verificationStatus === DroneVerificationStatus.Verified && (!c.expiryDate || c.expiryDate > new Date())).length,
          qualificationCount: operator.qualifications.length,
        },
      },
    };
  }

  async createOperator(dto: CreateDroneOperatorInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateCreateDroneOperatorInput(dto);
    this.assertGeographyScope(dto, actor);
    const n = this.normalizeContacts(dto);
    await this.assertNoOperatorDuplicates({ operatorCode: dto.operatorCode.trim(), adminUserId: dto.adminUserId, email: n.email, phone: n.phone, excludeId: null });
    const created = await this.prismaAny.droneOperator.create({
      data: {
        operatorCode: dto.operatorCode.trim(),
        fullName: dto.fullName.trim(),
        email: n.email,
        phone: n.phone,
        country: dto.country?.trim() ?? null,
        state: dto.state?.trim() ?? null,
        lga: dto.lga?.trim() ?? null,
        operatingAddress: dto.operatingAddress?.trim() ?? null,
        employmentType: dto.employmentType ?? "AgencyStaff",
        assignedAgencyId: dto.assignedAgencyId ?? null,
        assignedOperatingBase: dto.assignedOperatingBase?.trim() ?? null,
        emergencyContactName: dto.emergencyContactName?.trim() ?? null,
        emergencyContactPhone: n.emergencyContactPhone,
        callsign: dto.callsign?.trim() ?? null,
        operatorRole: dto.operatorRole ?? "Operator",
        adminUserId: dto.adminUserId ?? null,
        maximumConcurrentMissions: dto.maximumConcurrentMissions ?? 1,
        emergencyCallAvailable: dto.emergencyCallAvailable ?? true,
        accountStatus: DroneOperatorAccountStatus.PendingReview,
        availabilityStatus: DroneOperatorAvailability.Unavailable,
      },
    });
    await this.audit(actor, "drone.operator_created", E.operator, created.id, { operatorCode: created.operatorCode });
    return { data: this.mapOperatorDetail(created, actor) };
  }

  async updateOperator(id: string, dto: UpdateDroneOperatorInput, actor: JwtPayload) {
    const existing = await this.findOperatorOrThrow(id);
    this.assertOperatorAccess(existing, actor);
    const n = this.normalizeContacts(dto);
    const patch: Record<string, unknown> = {
      ...(dto.operatorCode !== undefined ? { operatorCode: dto.operatorCode.trim() } : {}),
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.email !== undefined ? { email: n.email } : {}),
      ...(dto.phone !== undefined ? { phone: n.phone } : {}),
      ...(dto.country !== undefined ? { country: dto.country?.trim() ?? null } : {}),
      ...(dto.state !== undefined ? { state: dto.state?.trim() ?? null } : {}),
      ...(dto.lga !== undefined ? { lga: dto.lga?.trim() ?? null } : {}),
      ...(dto.operatingAddress !== undefined ? { operatingAddress: dto.operatingAddress?.trim() ?? null } : {}),
      ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType } : {}),
      ...(dto.assignedAgencyId !== undefined ? { assignedAgencyId: dto.assignedAgencyId ?? null } : {}),
      ...(dto.assignedOperatingBase !== undefined ? { assignedOperatingBase: dto.assignedOperatingBase?.trim() ?? null } : {}),
      ...(dto.emergencyContactName !== undefined ? { emergencyContactName: dto.emergencyContactName?.trim() ?? null } : {}),
      ...(dto.emergencyContactPhone !== undefined ? { emergencyContactPhone: n.emergencyContactPhone } : {}),
      ...(dto.callsign !== undefined ? { callsign: dto.callsign?.trim() ?? null } : {}),
      ...(dto.operatorRole !== undefined ? { operatorRole: dto.operatorRole } : {}),
      ...(dto.adminUserId !== undefined ? { adminUserId: dto.adminUserId ?? null } : {}),
      ...(dto.maximumConcurrentMissions !== undefined ? { maximumConcurrentMissions: dto.maximumConcurrentMissions } : {}),
      ...(dto.emergencyCallAvailable !== undefined ? { emergencyCallAvailable: dto.emergencyCallAvailable } : {}),
    };
    this.assertUpdateAllowedForActor(actor, existing, patch);
    this.assertGeographyScope({ country: patch.country as string | undefined, state: patch.state as string | undefined, lga: patch.lga as string | undefined }, actor, existing);
    await this.assertNoOperatorDuplicates({ operatorCode: patch.operatorCode as string | undefined, adminUserId: patch.adminUserId as string | null | undefined, email: patch.email as string | null | undefined, phone: patch.phone as string | null | undefined, excludeId: id });
    const updated = await this.prismaAny.droneOperator.update({ where: { id }, data: patch });
    await this.audit(actor, "drone.operator_updated", E.operator, id, { before: this.auditOperatorState(existing), after: this.auditOperatorState(updated) });
    return { data: this.mapOperatorDetail(updated, actor) };
  }

  async updateStatus(id: string, dto: OperatorStatusInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateOperatorStatusInput(dto);
    const operator = await this.findOperatorOrThrow(id);
    this.assertOperatorAccess(operator, actor);
    if (dto.availabilityStatus) assertAvailabilityTransition(operator.availabilityStatus, dto.availabilityStatus);
    const nextAccount = dto.accountStatus ?? operator.accountStatus;
    const nextAvailability = dto.availabilityStatus ?? operator.availabilityStatus;
    if ([DroneOperatorAvailability.Assigned, DroneOperatorAvailability.OnMission].includes(nextAvailability)) {
      assertAccountStatusAllowsAssignment(nextAccount, nextAvailability);
    }
    const patch: Record<string, unknown> = {
      ...(dto.accountStatus ? { accountStatus: dto.accountStatus } : {}),
      ...(dto.availabilityStatus ? { availabilityStatus: dto.availabilityStatus } : {}),
      ...(dto.accountStatus === DroneOperatorAccountStatus.Suspended ? { suspendedAt: new Date(), suspendedById: actor.sub, suspensionReason: dto.reason?.trim() ?? null } : {}),
      ...(dto.accountStatus && dto.accountStatus !== DroneOperatorAccountStatus.Suspended && operator.accountStatus === DroneOperatorAccountStatus.Suspended ? { reactivatedAt: new Date(), reactivatedById: actor.sub } : {}),
    };
    const [updated] = await this.prisma.$transaction([
      this.prismaAny.droneOperator.update({ where: { id }, data: patch }),
      this.prismaAny.droneOperatorStatusHistory.create({
        data: {
          operatorId: id,
          previousStatus: operator.accountStatus,
          newStatus: nextAccount,
          previousAvailability: operator.availabilityStatus,
          newAvailability: nextAvailability,
          reason: dto.reason?.trim() ?? null,
          changedById: actor.sub,
        },
      }),
    ]);
    await this.audit(actor, "drone.operator_status_updated", E.operator, id, { previousStatus: operator.accountStatus, newStatus: updated.accountStatus, previousAvailability: operator.availabilityStatus, newAvailability: updated.availabilityStatus, reason: dto.reason ?? null });
    return { data: this.mapOperatorDetail(updated, actor) };
  }

  async submitForVerification(id: string, notes: string | undefined, actor: JwtPayload) {
    const operator = await this.findOperatorOrThrow(id);
    this.assertOperatorAccess(operator, actor);
    if (actor.role !== AdminRoleName.DroneOperator) this.assertCanManageOperator(actor);
    if (actor.role === AdminRoleName.DroneOperator && operator.adminUserId !== actor.sub) throw new ForbiddenException("Drone operators can only submit their own profile");
    const updated = await this.prismaAny.droneOperator.update({ where: { id }, data: { accountStatus: DroneOperatorAccountStatus.PendingReview } });
    await this.audit(actor, "drone.operator_submitted_for_verification", E.operator, id, { notes: notes?.trim() ?? null });
    return { data: this.mapOperatorDetail(updated, actor) };
  }

  async verifyLicence(operatorId: string, licenceId: string, dto: VerificationActionInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateVerificationActionInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    if (operator.adminUserId === actor.sub) throw new ForbiddenException("You cannot verify your own licence");
    const licence = await this.prismaAny.droneOperatorLicence.findFirst({ where: { id: licenceId, operatorId } });
    if (!licence) throw new NotFoundException("Licence not found");
    const verificationStatus = mapVerificationActionToStatus(dto.action);
    const updated = await this.prismaAny.droneOperatorLicence.update({ where: { id: licenceId }, data: { verificationStatus, verifiedAt: new Date(), verifiedById: actor.sub, rejectionReason: verificationStatus === DroneVerificationStatus.Rejected ? dto.notes.trim() : null } });
    await this.audit(actor, "drone.operator_licence_verified", E.licence, licenceId, { operatorId, action: dto.action, verificationStatus });
    return { data: updated };
  }

  async verifyCertification(operatorId: string, certId: string, dto: VerificationActionInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateVerificationActionInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    if (operator.adminUserId === actor.sub) throw new ForbiddenException("You cannot verify your own certification");
    const cert = await this.prismaAny.droneOperatorCertification.findFirst({ where: { id: certId, operatorId } });
    if (!cert) throw new NotFoundException("Certification not found");
    const verificationStatus = mapVerificationActionToStatus(dto.action);
    const updated = await this.prismaAny.droneOperatorCertification.update({ where: { id: certId }, data: { verificationStatus, verifiedAt: new Date(), verifiedById: actor.sub, rejectionReason: verificationStatus === DroneVerificationStatus.Rejected ? dto.notes.trim() : null } });
    await this.audit(actor, "drone.operator_certification_verified", E.cert, certId, { operatorId, action: dto.action, verificationStatus });
    return { data: updated };
  }

  async createLicence(operatorId: string, dto: CreateLicenceInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateCreateLicenceInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const licenceNumber = dto.licenceNumber.trim();
    const dup = await this.prismaAny.droneOperatorLicence.findFirst({ where: { licenceNumber } });
    if (dup) throw new ConflictException("Licence number already exists");
    const created = await this.prismaAny.droneOperatorLicence.create({ data: { operatorId, licenceNumber, licenceCategory: dto.licenceCategory.trim(), issuingAuthority: dto.issuingAuthority.trim(), issueDate: this.parseDate(dto.issueDate), expiryDate: this.parseDate(dto.expiryDate), documentObjectKey: dto.documentObjectKey?.trim() ?? null, documentMimeType: dto.documentMimeType?.trim() ?? null, documentChecksum: dto.documentChecksum?.trim() ?? null } });
    await this.audit(actor, "drone.operator_licence_created", E.licence, created.id, { operatorId, licenceNumber });
    return { data: created };
  }

  async updateLicence(operatorId: string, licenceId: string, dto: UpdateLicenceInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const existing = await this.prismaAny.droneOperatorLicence.findFirst({ where: { id: licenceId, operatorId } });
    if (!existing) throw new NotFoundException("Licence not found");
    if (dto.licenceNumber && dto.licenceNumber.trim() !== existing.licenceNumber) {
      const dup = await this.prismaAny.droneOperatorLicence.findFirst({ where: { licenceNumber: dto.licenceNumber.trim(), id: { not: licenceId } } });
      if (dup) throw new ConflictException("Licence number already exists");
    }
    const updated = await this.prismaAny.droneOperatorLicence.update({ where: { id: licenceId }, data: { ...(dto.licenceNumber !== undefined ? { licenceNumber: dto.licenceNumber.trim() } : {}), ...(dto.licenceCategory !== undefined ? { licenceCategory: dto.licenceCategory.trim() } : {}), ...(dto.issuingAuthority !== undefined ? { issuingAuthority: dto.issuingAuthority.trim() } : {}), ...(dto.issueDate !== undefined ? { issueDate: this.parseDate(dto.issueDate) } : {}), ...(dto.expiryDate !== undefined ? { expiryDate: this.parseDate(dto.expiryDate) } : {}), ...(dto.documentObjectKey !== undefined ? { documentObjectKey: dto.documentObjectKey?.trim() ?? null } : {}), ...(dto.documentMimeType !== undefined ? { documentMimeType: dto.documentMimeType?.trim() ?? null } : {}), ...(dto.documentChecksum !== undefined ? { documentChecksum: dto.documentChecksum?.trim() ?? null } : {}) } });
    await this.audit(actor, "drone.operator_licence_updated", E.licence, licenceId, { operatorId });
    return { data: updated };
  }

  async createCertification(operatorId: string, dto: CreateCertificationInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateCreateCertificationInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const created = await this.prismaAny.droneOperatorCertification.create({ data: { operatorId, certificationType: dto.certificationType, trainingProvider: dto.trainingProvider?.trim() ?? null, certificateNumber: dto.certificateNumber?.trim() ?? null, issueDate: this.parseDate(dto.issueDate), expiryDate: this.parseDate(dto.expiryDate), documentObjectKey: dto.documentObjectKey?.trim() ?? null } });
    await this.audit(actor, "drone.operator_certification_created", E.cert, created.id, { operatorId, certificationType: dto.certificationType });
    return { data: created };
  }

  async updateCertification(operatorId: string, certId: string, dto: UpdateCertificationInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const existing = await this.prismaAny.droneOperatorCertification.findFirst({ where: { id: certId, operatorId } });
    if (!existing) throw new NotFoundException("Certification not found");
    const updated = await this.prismaAny.droneOperatorCertification.update({ where: { id: certId }, data: { ...(dto.certificationType !== undefined ? { certificationType: dto.certificationType } : {}), ...(dto.trainingProvider !== undefined ? { trainingProvider: dto.trainingProvider?.trim() ?? null } : {}), ...(dto.certificateNumber !== undefined ? { certificateNumber: dto.certificateNumber?.trim() ?? null } : {}), ...(dto.issueDate !== undefined ? { issueDate: this.parseDate(dto.issueDate) } : {}), ...(dto.expiryDate !== undefined ? { expiryDate: this.parseDate(dto.expiryDate) } : {}), ...(dto.documentObjectKey !== undefined ? { documentObjectKey: dto.documentObjectKey?.trim() ?? null } : {}) } });
    await this.audit(actor, "drone.operator_certification_updated", E.cert, certId, { operatorId });
    return { data: updated };
  }

  async createQualification(operatorId: string, dto: CreateQualificationInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateCreateQualificationInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const created = await this.prismaAny.droneOperatorQualification.create({ data: { operatorId, droneDeviceId: dto.droneDeviceId ?? null, droneModel: dto.droneModel?.trim() ?? null, qualificationLevel: dto.qualificationLevel ?? "Trainee", qualifiedAt: this.parseDate(dto.qualifiedAt), expiresAt: this.parseDate(dto.expiresAt), notes: dto.notes?.trim() ?? null, assessedById: actor.sub } });
    await this.audit(actor, "drone.operator_qualification_created", E.qualification, created.id, { operatorId });
    return { data: created };
  }

  async updateQualification(operatorId: string, qualificationId: string, dto: UpdateQualificationInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const existing = await this.prismaAny.droneOperatorQualification.findFirst({ where: { id: qualificationId, operatorId } });
    if (!existing) throw new NotFoundException("Qualification not found");
    const updated = await this.prismaAny.droneOperatorQualification.update({ where: { id: qualificationId }, data: { ...(dto.droneDeviceId !== undefined ? { droneDeviceId: dto.droneDeviceId ?? null } : {}), ...(dto.droneModel !== undefined ? { droneModel: dto.droneModel?.trim() ?? null } : {}), ...(dto.qualificationLevel !== undefined ? { qualificationLevel: dto.qualificationLevel } : {}), ...(dto.qualifiedAt !== undefined ? { qualifiedAt: this.parseDate(dto.qualifiedAt) } : {}), ...(dto.expiresAt !== undefined ? { expiresAt: this.parseDate(dto.expiresAt) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}), ...(dto.status !== undefined ? { status: dto.status } : {}) } });
    await this.audit(actor, "drone.operator_qualification_updated", E.qualification, qualificationId, { operatorId });
    return { data: updated };
  }

  async listDocuments(operatorId: string, actor: JwtPayload) {
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const rows = await this.prismaAny.droneOperatorDocument.findMany({
      where: { operatorId, ...(this.canAccessRestricted(actor, operator) ? {} : { restricted: false }) },
      orderBy: { createdAt: "desc" },
    });
    await this.audit(actor, "drone.operator_documents_listed", E.document, operatorId, { operatorId });
    return { data: rows };
  }

  async presignDocument(operatorId: string, dto: DocumentPresignInput, actor: JwtPayload) {
    validateDocumentPresignInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const objectKey = droneOperatorDocumentObjectKey(operatorId, dto.fileName);
    return { data: { operatorId, bucket: process.env.S3_BUCKET ?? "the-eye", objectKey, putUrl: createS3PresignedPutUrl(objectKey, 900, dto.contentType), expiresInSeconds: 900 } };
  }

  async confirmDocument(operatorId: string, dto: DocumentConfirmInput, actor: JwtPayload) {
    validateDocumentConfirmInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    assertDroneOperatorDocumentObjectKey(operatorId, dto.objectKey, dto.bucket, dto.mimeType);
    const restricted = restrictedDocumentTypes().has(dto.documentType as any);
    if (restricted && !this.canAccessRestricted(actor, operator)) throw new ForbiddenException("Insufficient permission to store restricted document");
    const created = await this.prismaAny.droneOperatorDocument.create({ data: { operatorId, documentType: dto.documentType, title: dto.title.trim(), bucket: dto.bucket, objectKey: dto.objectKey, mimeType: dto.mimeType, checksum: dto.checksum?.trim() ?? null, sizeBytes: dto.sizeBytes ?? null, restricted, uploadedById: actor.typ === "admin" ? actor.sub : null, confirmedAt: new Date() } });
    await this.audit(actor, "drone.operator_document_confirmed", E.document, created.id, { operatorId, documentType: dto.documentType });
    return { data: created };
  }

  async authorizeDocumentDownload(operatorId: string, documentId: string, actor: JwtPayload) {
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const doc = await this.prismaAny.droneOperatorDocument.findFirst({ where: { id: documentId, operatorId } });
    if (!doc) throw new NotFoundException("Document not found");
    if (doc.restricted && !this.canAccessRestricted(actor, operator)) throw new ForbiddenException("Restricted document");
    await this.audit(actor, "drone.operator_document_download_authorized", E.document, documentId, { operatorId, restricted: doc.restricted });
    return { data: { documentId, downloadUrl: createS3PresignedGetUrl(doc.objectKey, 300), expiresInSeconds: 300 } };
  }

  async listSafetyRecords(operatorId: string, actor: JwtPayload) {
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const rows = await this.prismaAny.droneOperatorSafetyRecord.findMany({
      where: { operatorId, ...(this.canAccessRestricted(actor, operator) ? {} : { restricted: false }) },
      include: { mission: { select: { id: true, missionCode: true, title: true, status: true } } },
      orderBy: { recordedAt: "desc" },
      take: 200,
    });
    return { data: rows };
  }

  async createSafetyRecord(operatorId: string, dto: CreateSafetyRecordInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateCreateSafetyRecordInput(dto);
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    if (dto.restricted && !this.canAccessRestricted(actor, operator)) throw new ForbiddenException("Restricted safety records require elevated permission");
    const created = await this.prismaAny.droneOperatorSafetyRecord.create({ data: { operatorId, recordType: dto.recordType, title: dto.title.trim(), description: dto.description?.trim() ?? null, missionId: dto.missionId ?? null, severity: dto.severity ?? "Info", restricted: dto.restricted ?? false, recordedById: actor.sub, metadata: dto.metadata ?? {} } });
    await this.audit(actor, "drone.operator_safety_record_created", E.safety, created.id, { operatorId, recordType: dto.recordType });
    return { data: created };
  }

  async getAuditHistory(operatorId: string, actor: JwtPayload) {
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const data = await this.prisma.auditLog.findMany({
      where: {
        action: { startsWith: "drone." },
        OR: [{ entityType: E.operator, entityId: operatorId }, { metadata: { path: ["operatorId"], equals: operatorId } as any }],
      } as never,
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return { data };
  }

  async listOperatorMissions(operatorId: string, actor: JwtPayload) {
    const operator = await this.findOperatorOrThrow(operatorId);
    this.assertOperatorAccess(operator, actor);
    const data = await this.prismaAny.droneMissionAssignment.findMany({
      where: { operatorId },
      include: { mission: { include: { drone: { select: { id: true, deviceId: true, model: true } }, incident: { select: { id: true, title: true, status: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return { data };
  }

  async listSuitableOperators(query: SuitableOperatorsQuery, actor: JwtPayload) {
    this.assertCanManageOperator(actor, false);
    if (!query.missionId?.trim()) throw new BadRequestException("missionId is required");
    const limit = resolvePageLimit(query.limit, 20);
    const mission = await this.prismaAny.droneMission.findUnique({ where: { id: query.missionId }, include: { incident: { select: { country: true, state: true, lga: true } }, drone: { select: { id: true, model: true } } } });
    if (!mission) throw new NotFoundException("Mission not found");
    const scope = adminGeographyWhere(actor);
    const operators = await this.prismaAny.droneOperator.findMany({
      where: { isActive: true, ...(scope ?? {}), ...(mission.incident?.country ? { country: mission.incident.country } : {}), ...(mission.incident?.state ? { state: mission.incident.state } : {}), ...(mission.incident?.lga ? { lga: mission.incident.lga } : {}) },
      include: { licences: true, certifications: true, qualifications: true, missionAssignments: { where: { status: { in: [DroneMissionAssignmentStatus.Pending, DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active] } }, select: { id: true } } },
      take: 200,
    });
    const data = operators
      .map((operator: any) => {
        const hasValidLicence = operator.licences.some((l: any) => isLicenceValid(l));
        const qualified = isQualificationValidForDrone(operator.qualifications, mission.droneId, mission.drone?.model ?? null);
        const activeMissionCount = operator.missionAssignments.length;
        const score = (operator.availabilityStatus === DroneOperatorAvailability.Available ? 35 : 0) + (operator.accountStatus === DroneOperatorAccountStatus.Active ? 20 : 0) + (hasValidLicence ? 20 : -40) + (qualified ? 15 : -20) + Math.max(0, 10 - activeMissionCount * 2);
        return { operator: this.mapOperatorListItem(operator, actor), score, rationale: { hasValidLicence, qualified, activeMissionCount } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return { data };
  }

  async assignToMission(dto: MissionAssignmentInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validateMissionAssignmentInput(dto);
    const mission = await this.prismaAny.droneMission.findUnique({ where: { id: dto.missionId }, include: { drone: { select: { id: true, model: true } } } });
    if (!mission) throw new NotFoundException("Mission not found");
    const operator = await this.prismaAny.droneOperator.findUnique({
      where: { id: dto.operatorId },
      include: {
        licences: true,
        certifications: true,
        qualifications: true,
        missionAssignments: { where: { status: { in: [DroneMissionAssignmentStatus.Pending, DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active] } }, select: { id: true } },
      },
    });
    if (!operator) throw new NotFoundException("Drone operator not found");
    this.assertOperatorAccess(operator, actor);
    if (dto.idempotencyKey?.trim()) {
      const existing = await this.prismaAny.droneMissionAssignment.findFirst({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
      if (existing) return { data: existing, idempotent: true };
    }
    const conflict = await this.prismaAny.droneMissionAssignment.findFirst({ where: { missionId: dto.missionId, operatorId: dto.operatorId, status: { in: [DroneMissionAssignmentStatus.Pending, DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active] } } });
    if (conflict) throw new ConflictException("Operator already has an active assignment for this mission");
    const checks = runOperatorAssignmentChecks({ accountStatus: operator.accountStatus, availabilityStatus: operator.availabilityStatus, licences: operator.licences, certifications: operator.certifications, qualifications: operator.qualifications, activeAssignmentCount: operator.missionAssignments.length, maximumConcurrentMissions: operator.maximumConcurrentMissions ?? 1, assignmentAccepted: false });
    const failed = checks.filter((c) => !c.passed);
    if (failed.length) throw new BadRequestException({ message: "Operator failed assignment compliance checks", failed });
    const idempotencyKey = dto.idempotencyKey?.trim() || buildBullJobId("drone-assignment", dto.missionId, dto.operatorId, Date.now());
    const created = await this.prismaAny.droneMissionAssignment.create({ data: { missionId: dto.missionId, operatorId: dto.operatorId, assignmentRole: dto.assignmentRole ?? "Primary", status: DroneMissionAssignmentStatus.Pending, assignedById: actor.sub, idempotencyKey } });
    await this.prismaAny.droneOperator.update({ where: { id: dto.operatorId }, data: { availabilityStatus: DroneOperatorAvailability.Assigned, accountStatus: operator.accountStatus === DroneOperatorAccountStatus.Active ? DroneOperatorAccountStatus.Assigned : operator.accountStatus } });
    await this.notifications?.enqueue({ channel: "in_app", adminUserId: operator.adminUserId, title: "New drone mission assignment", body: `You were assigned to mission ${mission.missionCode ?? mission.title}`, priority: "High", metadata: { assignmentId: created.id, missionId: mission.id, idempotencyKey: buildBullJobId("drone-assignment-notify", created.id, operator.adminUserId) } } as any);
    await this.audit(actor, "drone.operator_assigned_to_mission", E.assignment, created.id, { missionId: dto.missionId, operatorId: dto.operatorId, idempotencyKey });
    return { data: created };
  }

  async respondToAssignment(assignmentId: string, dto: AssignmentResponseInput, actor: JwtPayload) {
    validateAssignmentResponseInput(dto);
    const assignment = await this.prismaAny.droneMissionAssignment.findUnique({ where: { id: assignmentId }, include: { operator: true, mission: { select: { id: true, title: true } } } });
    if (!assignment) throw new NotFoundException("Assignment not found");
    this.assertCanRespondToAssignment(assignment, actor);
    if (assignment.status !== DroneMissionAssignmentStatus.Pending) throw new ConflictException("Assignment has already been responded to");
    const status = dto.action === "accept" ? DroneMissionAssignmentStatus.Accepted : DroneMissionAssignmentStatus.Declined;
    const updateMany = await this.prismaAny.droneMissionAssignment.updateMany({
      where: { id: assignmentId, ...(dto.version !== undefined ? { version: dto.version } : {}), status: DroneMissionAssignmentStatus.Pending },
      data: { status, respondedAt: new Date(), declineReason: dto.action === "decline" ? dto.reason?.trim() ?? null : null, version: { increment: 1 } },
    });
    if (!updateMany.count) throw new ConflictException("Assignment response version conflict");
    const updated = await this.prismaAny.droneMissionAssignment.findUnique({ where: { id: assignmentId } });
    await this.prismaAny.droneOperator.update({ where: { id: assignment.operatorId }, data: dto.action === "accept" ? { availabilityStatus: DroneOperatorAvailability.Assigned } : { availabilityStatus: DroneOperatorAvailability.Available, accountStatus: DroneOperatorAccountStatus.Active } });
    if (assignment.assignedById) {
      await this.notifications?.enqueue({ channel: "in_app", adminUserId: assignment.assignedById, title: `Mission assignment ${dto.action === "accept" ? "accepted" : "declined"}`, body: `${assignment.operator.fullName} ${dto.action}ed assignment for ${assignment.mission.title}`, priority: "Normal", metadata: { assignmentId, missionId: assignment.mission.id, reason: dto.reason ?? null, idempotencyKey: buildBullJobId("drone-assignment-response", assignmentId, dto.action, updated?.version ?? 0) } } as any);
    }
    await this.audit(actor, "drone.operator_assignment_responded", E.assignment, assignmentId, { action: dto.action, reason: dto.reason ?? null, version: updated?.version });
    return { data: updated };
  }

  async runPreflightCheck(missionId: string, dto: PreflightCheckInput, actor: JwtPayload) {
    this.assertCanManageOperator(actor);
    validatePreflightCheckInput(dto);
    const mission = await this.prismaAny.droneMission.findUnique({
      where: { id: missionId },
      include: {
        drone: true,
        assignments: {
          where: { status: DroneMissionAssignmentStatus.Accepted },
          include: { operator: { include: { licences: true, certifications: true, qualifications: true, missionAssignments: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    if (!mission) throw new NotFoundException("Mission not found");
    const operator = mission.assignments[0]?.operator;
    if (!operator) throw new BadRequestException("No accepted operator assignment found for mission");
    this.assertOperatorAccess(operator, actor);
    const checks = runPreflightChecks({
      accountStatus: operator.accountStatus,
      availabilityStatus: operator.availabilityStatus,
      licences: operator.licences,
      certifications: operator.certifications,
      qualifications: operator.qualifications,
      activeAssignmentCount: operator.missionAssignments.filter((it: any) => [DroneMissionAssignmentStatus.Pending, DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active].includes(it.status)).length,
      maximumConcurrentMissions: operator.maximumConcurrentMissions ?? 1,
      assignmentAccepted: true,
      droneActive: Boolean(mission.drone?.isActive),
      droneMaintenanceCurrent: (mission.drone?.healthStatus ?? "Healthy") !== "Critical",
      batteryHealthy: (mission.drone?.batteryLevel ?? 0) >= 25,
      gpsHealthy: (mission.drone?.signalStrength ?? 0) >= 20,
      geofenceReviewed: dto.geofenceReviewed ?? false,
      noFlyZonesReviewed: dto.noFlyZonesReviewed ?? false,
      weatherCheckRecorded: dto.weatherCheckRecorded ?? false,
      missionReferencePresent: Boolean(mission.incidentId || mission.id),
    }, dto.requiredCertifications ?? []);
    const failed = checks.filter((c) => !c.passed);
    const passed = failed.length === 0;
    if (!passed && !dto.emergencyOverride) {
      await this.audit(actor, "drone.mission_preflight_blocked", E.preflight, missionId, { missionId, operatorId: operator.id, failed });
      throw new BadRequestException({ message: "Preflight checks failed", failed });
    }
    const preflight = await this.prismaAny.droneMissionPreflightCheck.create({ data: { missionId, operatorId: operator.id, passed, failedChecks: failed, emergencyOverride: dto.emergencyOverride ?? false, overrideReason: dto.emergencyOverride ? dto.overrideReason?.trim() ?? null : null, overrideById: dto.emergencyOverride ? actor.sub : null } });
    await this.audit(actor, dto.emergencyOverride ? "drone.mission_preflight_override" : "drone.mission_preflight_checked", E.preflight, preflight.id, { missionId, operatorId: operator.id, passed, failedCount: failed.length });
    return { data: preflight, checks };
  }

  private buildOperatorWhere(query: OperatorListQuery, actor: JwtPayload, cursor: ReturnType<typeof decodeDateIdCursor>) {
    const scope = adminGeographyWhere(actor);
    const now = new Date();
    const licenceStatus = query.licenceStatus?.trim();
    const activeMission = query.activeMission?.trim().toLowerCase();
    return {
      ...(scope ?? {}),
      ...(query.q?.trim() ? { OR: [{ fullName: { contains: query.q.trim(), mode: "insensitive" } }, { operatorCode: { contains: query.q.trim(), mode: "insensitive" } }, { email: { contains: query.q.trim(), mode: "insensitive" } }, { phone: { contains: query.q.trim(), mode: "insensitive" } }] } : {}),
      ...(query.operatorCode ? { operatorCode: { contains: query.operatorCode.trim(), mode: "insensitive" } } : {}),
      ...(query.country ? { country: query.country.trim() } : {}),
      ...(query.state ? { state: query.state.trim() } : {}),
      ...(query.lga ? { lga: query.lga.trim() } : {}),
      ...(query.agencyId ? { assignedAgencyId: query.agencyId.trim() } : {}),
      ...(query.operatingBase ? { assignedOperatingBase: { contains: query.operatingBase.trim(), mode: "insensitive" } } : {}),
      ...(query.operatorRole ? { operatorRole: query.operatorRole.trim() } : {}),
      ...(query.availability ? { availabilityStatus: query.availability.trim() } : {}),
      ...(query.accountStatus ? { accountStatus: query.accountStatus.trim() } : {}),
      ...(licenceStatus ? licenceStatus === "valid" ? { licences: { some: { verificationStatus: DroneVerificationStatus.Verified, OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] } } } : licenceStatus === "expired" ? { licences: { some: { expiryDate: { lt: now } } } } : { licences: { some: { verificationStatus: licenceStatus } } } : {}),
      ...(query.certification ? { certifications: { some: { certificationType: query.certification.trim() } } } : {}),
      ...(query.droneQualification ? { qualifications: { some: { OR: [{ droneDeviceId: query.droneQualification.trim() }, { droneModel: query.droneQualification.trim() }] } } } : {}),
      ...(activeMission === "true" ? { missionAssignments: { some: { status: { in: [DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active] } } } } : activeMission === "false" ? { missionAssignments: { none: { status: { in: [DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active] } } } } : {}),
      ...dateIdCursorWhere(cursor),
    };
  }

  private assertOperatorRead(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can access drone operators");
    const perms = actor.permissions ?? [];
    if (perms.length && !perms.some((p) => ["drone:operator:read", "drone:read", "drone:manage", "drone:operator:audit:read"].includes(p))) {
      throw new ForbiddenException("Insufficient permissions to read drone operators");
    }
  }

  private assertCanManageOperator(actor: JwtPayload, write = true) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can manage drone operators");
    const perms = actor.permissions ?? [];
    if (perms.length) {
      const readOk = perms.some((p) => ["drone:operator:read", "drone:read", "drone:manage", "drone:operator:audit:read"].includes(p));
      const writeOk = perms.some((p) => ["drone:operator:create", "drone:operator:update", "drone:operator:verify", "drone:operator:suspend", "drone:operator:assign", "drone:manage"].includes(p));
      if (write && !writeOk) throw new ForbiddenException("Insufficient permissions for drone operator changes");
      if (!write && !readOk) throw new ForbiddenException("Insufficient permissions for drone operators");
      return;
    }
    const role = actor.role as AdminRoleName | undefined;
    const writeRoles = new Set<AdminRoleName>([AdminRoleName.SuperAdmin, AdminRoleName.CountryAdmin, AdminRoleName.StateAdmin, AdminRoleName.LgaAdmin, AdminRoleName.DroneCommander, AdminRoleName.AgencyAdmin]);
    const readRoles = new Set<AdminRoleName>([...writeRoles, AdminRoleName.OversightAuditor, AdminRoleName.CallCenterAgent, AdminRoleName.PoliceSecurityOfficer, AdminRoleName.DroneOperator]);
    if (write ? !writeRoles.has(role as AdminRoleName) : !readRoles.has(role as AdminRoleName)) {
      throw new ForbiddenException("Role is not allowed to manage drone operators");
    }
  }

  private assertOperatorAccess(operator: any, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can access operators");
    if (actor.role === AdminRoleName.SuperAdmin) return;
    if (actor.role === AdminRoleName.DroneOperator && operator.adminUserId !== actor.sub) throw new ForbiddenException("Drone operators can only access their own profile");
    if (!adminCanAccessGeography({ country: operator.country, state: operator.state, lga: operator.lga }, actor)) throw new ForbiddenException("Operator is outside your jurisdiction");
    if ((actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) && actor.agencyId && operator.assignedAgencyId && operator.assignedAgencyId !== actor.agencyId) throw new ForbiddenException("Operator is outside your agency scope");
  }

  private assertGeographyScope(input: { country?: string | null; state?: string | null; lga?: string | null }, actor: JwtPayload, existing?: any) {
    const country = input.country === undefined ? existing?.country : input.country;
    const state = input.state === undefined ? existing?.state : input.state;
    const lga = input.lga === undefined ? existing?.lga : input.lga;
    if (!adminCanAccessGeography({ country: country ?? undefined, state: state ?? undefined, lga: lga ?? undefined }, actor)) throw new ForbiddenException("Operator geography is outside your jurisdiction");
  }

  private assertUpdateAllowedForActor(actor: JwtPayload, operator: any, patch: Record<string, unknown>) {
    if (actor.role !== AdminRoleName.DroneOperator) return this.assertCanManageOperator(actor);
    if (operator.adminUserId !== actor.sub) throw new ForbiddenException("You can only edit your own operator profile");
    const allowed = new Set(["fullName", "phone", "email", "operatingAddress", "assignedOperatingBase", "emergencyContactName", "emergencyContactPhone", "callsign", "profilePhotoObjectKey"]);
    const forbidden = Object.keys(patch).filter((k) => !allowed.has(k));
    if (forbidden.length) throw new ForbiddenException(`Drone operator self-edit does not allow: ${forbidden.join(", ")}`);
  }

  private assertCanRespondToAssignment(assignment: any, actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can respond to assignments");
    if (actor.role === AdminRoleName.DroneOperator) {
      if (assignment.operator.adminUserId !== actor.sub) throw new ForbiddenException("You can only respond to your own assignment");
      return;
    }
    this.assertCanManageOperator(actor);
  }

  private canAccessRestricted(actor: JwtPayload, operator: any) {
    if ([AdminRoleName.SuperAdmin, AdminRoleName.OversightAuditor, AdminRoleName.DroneCommander, AdminRoleName.CountryAdmin, AdminRoleName.StateAdmin].includes(actor.role as AdminRoleName)) return true;
    return actor.role === AdminRoleName.DroneOperator && operator.adminUserId === actor.sub;
  }

  private normalizeContacts(dto: Partial<CreateDroneOperatorInput & UpdateDroneOperatorInput>) {
    return {
      email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone !== undefined ? this.normalizePhone(dto.phone, "phone") : undefined,
      emergencyContactPhone: dto.emergencyContactPhone !== undefined ? this.normalizePhone(dto.emergencyContactPhone, "emergencyContactPhone") : undefined,
    };
  }

  private normalizePhone(raw: string | undefined, field: string) {
    if (raw === undefined) return undefined;
    if (!raw.trim()) return null;
    const normalized = normalizePhoneNumber(raw);
    if (!normalized || !isValidPhoneNumber(normalized)) throw new BadRequestException(`Invalid ${field}`);
    return normalized;
  }

  private parseDate(value: string | undefined) {
    if (value === undefined) return undefined;
    if (!value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid date value: ${value}`);
    return date;
  }

  private async assertNoOperatorDuplicates(input: { operatorCode?: string; adminUserId?: string | null; email?: string | null; phone?: string | null; excludeId: string | null }) {
    const checks: Array<{ where: Record<string, unknown>; label: string }> = [];
    if (input.operatorCode) checks.push({ where: { operatorCode: input.operatorCode }, label: "operatorCode" });
    if (input.adminUserId) checks.push({ where: { adminUserId: input.adminUserId }, label: "adminUserId" });
    if (input.email) checks.push({ where: { email: input.email }, label: "email" });
    if (input.phone) checks.push({ where: { phone: input.phone }, label: "phone" });
    for (const check of checks) {
      const duplicate = await this.prismaAny.droneOperator.findFirst({ where: { ...check.where, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) } });
      if (duplicate) throw new ConflictException(`Duplicate ${check.label} detected`);
    }
  }

  private async findOperatorOrThrow(operatorId: string) {
    const operator = await this.prismaAny.droneOperator.findUnique({ where: { id: operatorId } });
    if (!operator) throw new NotFoundException("Drone operator not found");
    return operator;
  }

  private mapOperatorListItem(operator: any, actor: JwtPayload) {
    const warning = operator.licences?.length ? operator.licences.map((l: any) => expiryWarningLevel(l.expiryDate)).sort((a: string, b: string) => this.warningRank(b) - this.warningRank(a))[0] : "none";
    return { id: operator.id, operatorCode: operator.operatorCode, fullName: operator.fullName, email: this.redact(operator.email, actor), phone: this.redact(operator.phone, actor), country: operator.country, state: operator.state, lga: operator.lga, accountStatus: operator.accountStatus, availabilityStatus: operator.availabilityStatus, assignedAgencyId: operator.assignedAgencyId, assignedOperatingBase: operator.assignedOperatingBase, activeAssignmentCount: operator.missionAssignments?.length ?? 0, licenceWarningLevel: warning, createdAt: operator.createdAt, updatedAt: operator.updatedAt };
  }

  private mapOperatorDetail(operator: any, actor: JwtPayload) {
    return { id: operator.id, operatorCode: operator.operatorCode, adminUserId: operator.adminUserId, fullName: operator.fullName, email: this.redact(operator.email, actor), phone: this.redact(operator.phone, actor), country: operator.country, state: operator.state, lga: operator.lga, operatingAddress: operator.operatingAddress, employmentType: operator.employmentType, assignedAgencyId: operator.assignedAgencyId, assignedOperatingBase: operator.assignedOperatingBase, emergencyContactName: operator.emergencyContactName, emergencyContactPhone: this.redact(operator.emergencyContactPhone, actor), callsign: operator.callsign, operatorRole: operator.operatorRole, accountStatus: operator.accountStatus, availabilityStatus: operator.availabilityStatus, maximumConcurrentMissions: operator.maximumConcurrentMissions, emergencyCallAvailable: operator.emergencyCallAvailable, suspensionReason: operator.suspensionReason, suspendedAt: operator.suspendedAt, reactivatedAt: operator.reactivatedAt, isActive: operator.isActive, createdAt: operator.createdAt, updatedAt: operator.updatedAt, assignedAgency: operator.assignedAgency ?? null, licences: operator.licences ?? [], certifications: operator.certifications ?? [], qualifications: operator.qualifications ?? [] };
  }

  private redact(value: string | null | undefined, actor: JwtPayload) {
    if (!value) return value ?? null;
    if (actor.role === AdminRoleName.SuperAdmin || actor.permissions?.includes("drone:manage")) return value;
    if (value.includes("@")) return value.replace(/^(.).+(@.*)$/, "$1***$2");
    if (value.startsWith("+")) return `${value.slice(0, 4)}****${value.slice(-2)}`;
    return "***";
  }

  private warningRank(level: string) {
    if (level === "expired") return 5;
    if (level === "7d") return 4;
    if (level === "30d") return 3;
    if (level === "60d") return 2;
    if (level === "90d") return 1;
    return 0;
  }

  private async buildMissionStats(operatorId: string) {
    const [totalAssignments, acceptedAssignments, activeAssignments, declinedAssignments, completedMissions] = await Promise.all([
      this.prismaAny.droneMissionAssignment.count({ where: { operatorId } }),
      this.prismaAny.droneMissionAssignment.count({ where: { operatorId, status: DroneMissionAssignmentStatus.Accepted } }),
      this.prismaAny.droneMissionAssignment.count({ where: { operatorId, status: DroneMissionAssignmentStatus.Active } }),
      this.prismaAny.droneMissionAssignment.count({ where: { operatorId, status: DroneMissionAssignmentStatus.Declined } }),
      this.prismaAny.droneMission.count({ where: { operatorId, status: "Completed" } }),
    ]);
    return { totalAssignments, acceptedAssignments, activeAssignments, declinedAssignments, completedMissions };
  }

  private async buildSafetySummary(operatorId: string) {
    const rows = await this.prismaAny.droneOperatorSafetyRecord.groupBy({ by: ["severity", "restricted"], where: { operatorId }, _count: { _all: true } });
    const summary = { total: 0, restricted: 0, bySeverity: {} as Record<string, number> };
    for (const row of rows) {
      summary.total += row._count._all;
      if (row.restricted) summary.restricted += row._count._all;
      summary.bySeverity[row.severity] = (summary.bySeverity[row.severity] ?? 0) + row._count._all;
    }
    return summary;
  }

  private auditOperatorState(operator: any) {
    return { fullName: operator.fullName, email: operator.email, phone: operator.phone, country: operator.country, state: operator.state, lga: operator.lga, accountStatus: operator.accountStatus, availabilityStatus: operator.availabilityStatus, assignedAgencyId: operator.assignedAgencyId, assignedOperatingBase: operator.assignedOperatingBase, maximumConcurrentMissions: operator.maximumConcurrentMissions, emergencyCallAvailable: operator.emergencyCallAvailable, operatorRole: operator.operatorRole };
  }

  private audit(actor: JwtPayload, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    return this.auditService.record({ actor, action, entityType, entityId, metadata });
  }
}
