import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash } from "crypto";
import {
  AdminRoleName,
  UserRole,
  buildIncidentPublicReference,
  effectivePreferredLocale,
  isEnabledCountryCode,
  isEnabledPreferredLocale,
  normalizeCountryCode,
  normalizePreferredLocale,
} from "@the-eye/shared";
import type { CitizenVehicle, CitizenVehiclePhoto, Prisma } from "@prisma/client";
import type { JwtPayload } from "../../common/auth/jwt";
import { adminCanAccessGeography } from "../../common/auth/admin-geography-scope";
import { hashPassword } from "../../common/auth/crypto";
import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import {
  assertAvatarObjectKey,
  assertKycObjectKey,
  assertVehiclePhotoObjectKey,
  avatarObjectKey,
  createStorageDownloadUrl,
  createStorageUploadUrl,
  getConfiguredStorageBucket,
  validateAvatarUpload,
  validateVehiclePhotoUpload,
  vehiclePhotoObjectKey,
} from "../../common/storage/s3-presign";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { isValidPhoneNumber, normalizePhoneNumber } from "../auth/phone-normalize";
import type {
  AvatarConfirmDto,
  AvatarPresignDto,
  ReviewKycDto,
  SubmitKycDto,
  UpdateCitizenProfileDto,
  UpdateCitizenVehicleDto,
  UpsertEmergencyContactDto,
  CreateCitizenVehicleDto,
  CreateOperationalAdminDto,
  UpdateUserAccountStatusDto,
} from "./dto/users.dto";
import { incompleteProfileLocation, isCitizenProfileComplete } from "./profile-complete";

const MAX_EMERGENCY_CONTACTS = 5;
const VEHICLE_PHOTO_MAX_COUNT = 8;
const VEHICLE_PHOTO_LIMIT_MESSAGE = "You can add up to 8 photos for each vehicle.";

type CitizenVehicleWithPhotos = Prisma.CitizenVehicleGetPayload<{
  include: { photos: true };
}>;

type DirectoryRow = {
  id: string;
  createdAt: Date;
  kind: "admin" | "citizen";
  name: string;
  email: string;
  role: string;
  status: string;
  scope: string;
  agency: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(actor: JwtPayload) {
    if (actor.typ === "admin") {
      const preferences = await this.prisma.adminUserPreference.findUnique({
        where: { adminUserId: actor.sub },
      });
      return {
        id: actor.sub,
        typ: actor.typ,
        email: actor.email ?? null,
        role: actor.role,
        permissions: actor.permissions ?? [],
        country: actor.country ?? null,
        countryCode: actor.countryCode ?? null,
        state: actor.state ?? null,
        lga: actor.lga ?? null,
        preferredLocale: preferences?.preferredLocale ?? null,
        effectivePreferredLocale: effectivePreferredLocale(preferences?.preferredLocale),
      };
    }

    return this.buildCitizenProfileResponse(actor.sub);
  }

  async updateMe(actor: JwtPayload, dto: UpdateCitizenProfileDto) {
    this.assertCitizen(actor);
    const forbiddenKeys = Object.keys(dto as object).filter((key) =>
      ["trustScore", "kycStatus", "role", "status", "email", "id", "typ"].includes(key),
    );
    if (forbiddenKeys.length > 0) {
      throw new BadRequestException(`Fields not editable: ${forbiddenKeys.join(", ")}`);
    }

    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    const country = dto.country?.trim();
    const countryCode = dto.countryCode === null
      ? null
      : dto.countryCode === undefined
        ? undefined
        : normalizeCountryCode(dto.countryCode);
    const preferredLocale = dto.preferredLocale === null
      ? null
      : dto.preferredLocale === undefined
        ? undefined
        : normalizePreferredLocale(dto.preferredLocale);
    const state = dto.state?.trim();
    const lga = dto.lga?.trim();
    const phone = dto.phone === null || dto.phone === undefined
      ? undefined
      : dto.phone.trim() === ""
        ? null
        : normalizePhoneNumber(dto.phone);

    if (phone !== undefined && phone !== null && !isValidPhoneNumber(phone)) {
      throw new BadRequestException("Enter a valid phone number");
    }
    if (countryCode !== undefined && countryCode !== null && !isEnabledCountryCode(countryCode)) {
      throw new BadRequestException("Unsupported countryCode");
    }
    if (preferredLocale !== undefined && preferredLocale !== null && !isEnabledPreferredLocale(preferredLocale)) {
      throw new BadRequestException("Unsupported preferredLocale");
    }
    if (phone) {
      const clash = await this.prisma.user.findFirst({
        where: { phone, NOT: { id: actor.sub } },
        select: { id: true },
      });
      if (clash) throw new ConflictException("Phone number is already linked to another account");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      include: { profile: true },
    });
    if (!existing) throw new NotFoundException("User not found");

    const nextProfile = {
      firstName: firstName ?? existing.profile?.firstName ?? "",
      lastName: lastName ?? existing.profile?.lastName ?? "",
      country: country ?? existing.profile?.country ?? "",
      countryCode: countryCode === undefined ? existing.profile?.countryCode ?? null : countryCode,
      preferredLocale: preferredLocale === undefined ? existing.profile?.preferredLocale ?? null : preferredLocale,
      state: state ?? existing.profile?.state ?? "",
      lga: lga ?? existing.profile?.lga ?? "",
      dateOfBirth: dto.dateOfBirth === undefined
        ? existing.profile?.dateOfBirth ?? null
        : dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : null,
      gender: dto.gender === undefined ? existing.profile?.gender ?? null : dto.gender?.trim() || null,
      address: dto.address === undefined ? existing.profile?.address ?? null : dto.address?.trim() || null,
      avatarUrl: existing.profile?.avatarUrl ?? null,
    };

    if (!nextProfile.firstName || !nextProfile.lastName) {
      throw new BadRequestException("First name and last name are required");
    }

    await this.prisma.$transaction(async (tx) => {
      if (phone !== undefined) {
        await tx.user.update({ where: { id: actor.sub }, data: { phone } });
      }
      await tx.profile.upsert({
        where: { userId: actor.sub },
        create: {
          userId: actor.sub,
          ...nextProfile,
          ...(!nextProfile.country && !nextProfile.state && !nextProfile.lga
            ? incompleteProfileLocation()
            : {}),
          country: nextProfile.country,
          countryCode: nextProfile.countryCode,
          preferredLocale: nextProfile.preferredLocale,
          state: nextProfile.state,
          lga: nextProfile.lga,
        },
        update: {
          firstName: nextProfile.firstName,
          lastName: nextProfile.lastName,
          country: nextProfile.country,
          countryCode: nextProfile.countryCode,
          preferredLocale: nextProfile.preferredLocale,
          state: nextProfile.state,
          lga: nextProfile.lga,
          dateOfBirth: nextProfile.dateOfBirth,
          gender: nextProfile.gender,
          address: nextProfile.address,
        },
      });
    });

    await this.audit.record({
      actor,
      action: "profile.updated",
      entityType: "profiles",
      entityId: actor.sub,
      metadata: {
        fields: Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined),
      },
    });

    return this.buildCitizenProfileResponse(actor.sub);
  }

  async listEmergencyContacts(actor: JwtPayload) {
    this.assertCitizen(actor);
    const contacts = await this.prisma.emergencyContact.findMany({
      where: { userId: actor.sub },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
    return { data: contacts.map((contact) => this.mapEmergencyContact(contact)) };
  }

  async createEmergencyContact(actor: JwtPayload, dto: UpsertEmergencyContactDto) {
    this.assertCitizen(actor);
    const count = await this.prisma.emergencyContact.count({ where: { userId: actor.sub } });
    if (count >= MAX_EMERGENCY_CONTACTS) {
      throw new BadRequestException(`You can save up to ${MAX_EMERGENCY_CONTACTS} emergency contacts`);
    }

    const phone = normalizePhoneNumber(dto.phone);
    if (!isValidPhoneNumber(phone)) throw new BadRequestException("Enter a valid phone number");

    const duplicate = await this.prisma.emergencyContact.findFirst({
      where: { userId: actor.sub, phone },
    });
    if (duplicate) throw new ConflictException("An emergency contact with this phone already exists");

    const contact = await this.prisma.emergencyContact.create({
      data: {
        userId: actor.sub,
        name: dto.name.trim(),
        phone,
        relationship: dto.relationship.trim(),
        priority: dto.priority ?? count + 1,
      },
    });

    await this.audit.record({
      actor,
      action: "emergency_contact.created",
      entityType: "emergency_contacts",
      entityId: contact.id,
      metadata: { phoneSuffix: phone.slice(-4) },
    });

    return this.mapEmergencyContact(contact);
  }

  async updateEmergencyContact(actor: JwtPayload, contactId: string, dto: UpsertEmergencyContactDto) {
    this.assertCitizen(actor);
    const existing = await this.prisma.emergencyContact.findFirst({
      where: { id: contactId, userId: actor.sub },
    });
    if (!existing) throw new NotFoundException("Emergency contact not found");

    const phone = normalizePhoneNumber(dto.phone);
    if (!isValidPhoneNumber(phone)) throw new BadRequestException("Enter a valid phone number");

    const duplicate = await this.prisma.emergencyContact.findFirst({
      where: { userId: actor.sub, phone, NOT: { id: contactId } },
    });
    if (duplicate) throw new ConflictException("An emergency contact with this phone already exists");

    const contact = await this.prisma.emergencyContact.update({
      where: { id: contactId },
      data: {
        name: dto.name.trim(),
        phone,
        relationship: dto.relationship.trim(),
        priority: dto.priority ?? existing.priority,
      },
    });

    await this.audit.record({
      actor,
      action: "emergency_contact.updated",
      entityType: "emergency_contacts",
      entityId: contact.id,
      metadata: { phoneSuffix: phone.slice(-4) },
    });

    return this.mapEmergencyContact(contact);
  }

  async deleteEmergencyContact(actor: JwtPayload, contactId: string) {
    this.assertCitizen(actor);
    const existing = await this.prisma.emergencyContact.findFirst({
      where: { id: contactId, userId: actor.sub },
    });
    if (!existing) throw new NotFoundException("Emergency contact not found");

    await this.prisma.emergencyContact.delete({ where: { id: contactId } });
    await this.audit.record({
      actor,
      action: "emergency_contact.deleted",
      entityType: "emergency_contacts",
      entityId: contactId,
      metadata: {},
    });
    return { ok: true };
  }

  async listMyVehicles(actor: JwtPayload) {
    this.assertCitizen(actor);
    const vehicles = await this.prisma.citizenVehicle.findMany({
      where: { userId: actor.sub },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
      include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    return { data: await Promise.all(vehicles.map((vehicle) => this.mapCitizenVehicle(vehicle))) };
  }

  async createMyVehicle(actor: JwtPayload, dto: CreateCitizenVehicleDto) {
    this.assertCitizen(actor);
    const payload = this.toCitizenVehicleCreateInput(dto);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existingCount = await tx.citizenVehicle.count({
          where: { userId: actor.sub },
        });
        const wantsPrimary = dto.isPrimary === true || existingCount === 0;
        const vehicle = await tx.citizenVehicle.create({
          data: {
            ...payload,
            userId: actor.sub,
            isPrimary: wantsPrimary,
          },
        });
        if (wantsPrimary) {
          await tx.citizenVehicle.updateMany({
            where: { userId: actor.sub, NOT: { id: vehicle.id } },
            data: { isPrimary: false },
          });
        }
        return vehicle;
      });
      return this.mapCitizenVehicle(created);
    } catch (error) {
      this.rethrowCitizenVehicleWriteError(error);
    }
  }

  async getMyVehicle(actor: JwtPayload, vehicleId: string) {
    this.assertCitizen(actor);
    const vehicle = await this.prisma.citizenVehicle.findFirst({
      where: { id: vehicleId, userId: actor.sub },
      include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    return this.mapCitizenVehicle(vehicle);
  }

  async updateMyVehicle(actor: JwtPayload, vehicleId: string, dto: UpdateCitizenVehicleDto) {
    this.assertCitizen(actor);
    const existing = await this.prisma.citizenVehicle.findFirst({
      where: { id: vehicleId, userId: actor.sub },
    });
    if (!existing) throw new NotFoundException("Vehicle not found");

    const data = this.toCitizenVehicleUpdateInput(dto);
    const hasDataFields = Object.keys(data).length > 0;
    const hasPrimaryToggle = dto.isPrimary !== undefined;
    if (!hasDataFields && !hasPrimaryToggle) {
      throw new BadRequestException("No vehicle changes provided");
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary === true) {
          await tx.citizenVehicle.updateMany({
            where: { userId: actor.sub },
            data: { isPrimary: false },
          });
        }
        const vehicle = await tx.citizenVehicle.update({
          where: { id: vehicleId },
          data: {
            ...data,
            ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          },
        });
        return vehicle;
      });
      return this.mapCitizenVehicle(updated);
    } catch (error) {
      this.rethrowCitizenVehicleWriteError(error);
    }
  }

  async deleteMyVehicle(actor: JwtPayload, vehicleId: string) {
    this.assertCitizen(actor);
    const existing = await this.prisma.citizenVehicle.findFirst({
      where: { id: vehicleId, userId: actor.sub },
    });
    if (!existing) throw new NotFoundException("Vehicle not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.citizenVehicle.delete({ where: { id: vehicleId } });
      if (!existing.isPrimary) return;

      // Primary delete rule: when the primary is deleted, promote the most
      // recently updated remaining vehicle. If none remain, zero primary is valid.
      const promote = await tx.citizenVehicle.findFirst({
        where: { userId: actor.sub },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      if (!promote) return;
      await tx.citizenVehicle.update({
        where: { id: promote.id },
        data: { isPrimary: true },
      });
    });

    return { ok: true };
  }

  async setMyVehiclePrimary(actor: JwtPayload, vehicleId: string, isPrimary: boolean) {
    this.assertCitizen(actor);
    if (!isPrimary) {
      throw new BadRequestException("Use vehicle update to clear primary status");
    }
    const existing = await this.prisma.citizenVehicle.findFirst({
      where: { id: vehicleId, userId: actor.sub },
    });
    if (!existing) throw new NotFoundException("Vehicle not found");

    const vehicle = await this.prisma.$transaction(async (tx) => {
      await tx.citizenVehicle.updateMany({
        where: { userId: actor.sub },
        data: { isPrimary: false },
      });
      return tx.citizenVehicle.update({
        where: { id: vehicleId },
        data: { isPrimary: true },
      });
    });
    return this.mapCitizenVehicle(vehicle);
  }

  async presignMyVehiclePhoto(
    actor: JwtPayload,
    vehicleId: string,
    dto: { contentType: string; fileName: string; sizeBytes?: number },
  ) {
    this.assertCitizen(actor);
    validateVehiclePhotoUpload(dto.contentType, dto.sizeBytes);
    const vehicle = await this.prisma.citizenVehicle.findFirst({
      where: { id: vehicleId, userId: actor.sub },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    const photoCount = await this.prisma.citizenVehiclePhoto.count({
      where: { vehicleId: vehicle.id },
    });
    if (photoCount >= VEHICLE_PHOTO_MAX_COUNT) {
      throw new BadRequestException(VEHICLE_PHOTO_LIMIT_MESSAGE);
    }

    const objectKey = vehiclePhotoObjectKey(actor.sub, vehicle.id, dto.fileName);
    try {
      const signed = await createStorageUploadUrl(objectKey, 900, dto.contentType);
      return {
        bucket: signed.bucket,
        objectKey,
        uploadUrl: signed.url,
        requiredHeaders: { "content-type": dto.contentType },
        expiresInSeconds: signed.expiresInSeconds,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Vehicle photo storage is not configured");
    }
  }

  async confirmMyVehiclePhoto(
    actor: JwtPayload,
    vehicleId: string,
    dto: {
      objectKey: string;
      contentType: string;
      angle: "FRONT" | "REAR" | "SIDE" | "OTHER";
      sizeBytes?: number;
      sortOrder?: number;
    },
  ) {
    this.assertCitizen(actor);
    validateVehiclePhotoUpload(dto.contentType, dto.sizeBytes);
    assertVehiclePhotoObjectKey(actor.sub, vehicleId, dto.objectKey, dto.contentType);
    const vehicle = await this.prisma.citizenVehicle.findFirst({
      where: { id: vehicleId, userId: actor.sub },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    const created = await this.prisma.$transaction(async (tx) => {
      const count = await tx.citizenVehiclePhoto.count({
        where: { vehicleId: vehicle.id },
      });
      if (count >= VEHICLE_PHOTO_MAX_COUNT) {
        throw new BadRequestException(VEHICLE_PHOTO_LIMIT_MESSAGE);
      }

      return tx.citizenVehiclePhoto.create({
        data: {
          vehicleId: vehicle.id,
          objectKey: dto.objectKey,
          contentType: dto.contentType,
          angle: dto.angle,
          sizeBytes: dto.sizeBytes,
          sortOrder: dto.sortOrder ?? count,
        },
      });
    });
    return this.mapCitizenVehiclePhoto(created);
  }

  async deleteMyVehiclePhoto(actor: JwtPayload, vehicleId: string, photoId: string) {
    this.assertCitizen(actor);
    const existing = await this.prisma.citizenVehiclePhoto.findFirst({
      where: {
        id: photoId,
        vehicleId,
        vehicle: { userId: actor.sub },
      },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Vehicle photo not found");
    await this.prisma.citizenVehiclePhoto.delete({ where: { id: photoId } });
    return { ok: true };
  }

  async presignAvatar(actor: JwtPayload, dto: AvatarPresignDto) {
    this.assertCitizen(actor);
    validateAvatarUpload(dto.contentType, dto.sizeBytes);
    const objectKey = avatarObjectKey(actor.sub, dto.fileName);
    try {
      const signed = await createStorageUploadUrl(objectKey, 900, dto.contentType);
      return {
        bucket: signed.bucket,
        objectKey,
        uploadUrl: signed.url,
        requiredHeaders: { "content-type": dto.contentType },
        expiresInSeconds: signed.expiresInSeconds,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Avatar storage is not configured");
    }
  }

  async confirmAvatar(actor: JwtPayload, dto: AvatarConfirmDto) {
    this.assertCitizen(actor);
    assertAvatarObjectKey(actor.sub, dto.objectKey, dto.bucket, dto.contentType);

    const bucket = getConfiguredStorageBucket();
    const avatarUrl = `storage://${bucket}/${dto.objectKey}`;
    const profile = await this.prisma.profile.findUnique({ where: { userId: actor.sub } });
    if (!profile) {
      throw new BadRequestException("Complete your profile before uploading an avatar");
    }

    await this.prisma.profile.update({
      where: { userId: actor.sub },
      data: { avatarUrl },
    });

    await this.audit.record({
      actor,
      action: "profile.avatar_updated",
      entityType: "profiles",
      entityId: actor.sub,
      metadata: { objectKey: dto.objectKey },
    });

    return this.buildCitizenProfileResponse(actor.sub);
  }

  async submitKyc(actor: JwtPayload, dto: SubmitKycDto) {
    this.assertCitizen(actor);
    if (dto.documentObjectKey) {
      assertKycObjectKey(actor.sub, dto.documentObjectKey);
    }

    const latest = await this.prisma.kycRecord.findFirst({
      where: { userId: actor.sub },
      orderBy: { createdAt: "desc" },
    });
    if (latest?.status === "Pending") {
      throw new ConflictException("A KYC submission is already pending review");
    }
    if (latest?.status === "Verified") {
      throw new ConflictException("Your identity is already verified");
    }

    const documentNumber = dto.documentNumber?.trim() || null;
    const documentHash = createHash("sha256")
      .update(
        [
          actor.sub,
          dto.documentType.trim().toLowerCase(),
          documentNumber?.toLowerCase() ?? "",
          dto.documentObjectKey ?? "",
        ].join("|"),
      )
      .digest("hex");

    const record = await this.prisma.kycRecord.create({
      data: {
        userId: actor.sub,
        documentType: dto.documentType.trim(),
        documentNumber,
        documentHash,
        status: "Pending",
      },
    });

    await this.audit.record({
      actor,
      action: "kyc.submitted",
      entityType: "kyc_records",
      entityId: record.id,
      metadata: { documentType: record.documentType },
    });

    return {
      id: record.id,
      status: record.status,
      documentType: record.documentType,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async listPendingKyc(actor: JwtPayload, query: CursorPageQuery = {}) {
    this.assertAdminWithUserManage(actor);
    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const take = limit + 1;

    const rows = await this.prisma.kycRecord.findMany({
      where: {
        status: "Pending",
        ...dateIdCursorWhere(cursor),
        user: this.citizenScopeWhere(actor),
      },
      include: {
        user: { include: { profile: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
    });

    const page = buildCursorPage(rows, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    return {
      ...page,
      data: page.data.map((row) => ({
        id: row.id,
        userId: row.userId,
        documentType: row.documentType,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        citizen: {
          displayName:
            [row.user.profile?.firstName, row.user.profile?.lastName].filter(Boolean).join(" ").trim() ||
            row.user.email ||
            row.user.phone ||
            "Citizen",
          email: row.user.email,
          phone: row.user.phone,
          country: row.user.profile?.country ?? null,
          state: row.user.profile?.state ?? null,
          lga: row.user.profile?.lga ?? null,
        },
      })),
    };
  }

  async reviewKyc(actor: JwtPayload, kycId: string, dto: ReviewKycDto) {
    this.assertAdminWithUserManage(actor);
    if (dto.decision === "reject" && !dto.reason?.trim()) {
      throw new BadRequestException("A rejection reason is required");
    }

    const record = await this.prisma.kycRecord.findUnique({
      where: { id: kycId },
      include: { user: { include: { profile: true } } },
    });
    if (!record) throw new NotFoundException("KYC record not found");
    if (record.status !== "Pending") throw new ConflictException("Only pending KYC records can be reviewed");

    this.assertCitizenInAdminScope(actor, record.user.profile);

    const updated = await this.prisma.kycRecord.update({
      where: { id: kycId },
      data: {
        status: dto.decision === "approve" ? "Verified" : "Rejected",
        reviewedBy: actor.sub,
        reviewedAt: new Date(),
        rejectionReason: dto.decision === "reject" ? dto.reason!.trim() : null,
      },
    });

    await this.audit.record({
      actor,
      action: dto.decision === "approve" ? "kyc.approved" : "kyc.rejected",
      entityType: "kyc_records",
      entityId: updated.id,
      metadata: {
        userId: updated.userId,
        reason: updated.rejectionReason,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    };
  }

  async getCitizenDetail(actor: JwtPayload, userId: string) {
    this.assertAdminWithUserManage(actor);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { homeCommunity: { select: { id: true, name: true } } } },
        trustedReporter: true,
        kycRecords: { orderBy: { createdAt: "desc" }, take: 5 },
        emergencyContacts: { orderBy: { priority: "asc" } },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    this.assertCitizenInAdminScope(actor, user.profile);

    const [reports, broadcasts, sightings, communityPosts, verifications, auditHistory, lastDeviceActivity] = await Promise.all([
      this.prisma.incident.findMany({
        where: { reporterId: userId },
        select: {
          id: true, type: true, title: true, status: true, priority: true, address: true,
          country: true, state: true, lga: true, submittedAt: true,
          assignedAgency: { select: { name: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 8,
      }),
      this.prisma.broadcast.findMany({
        where: { creatorUserId: userId },
        select: {
          id: true, type: true, title: true, status: true, country: true, state: true,
          lga: true, createdAt: true, publishedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.prisma.broadcastSighting.findMany({
        where: { reporterUserId: userId },
        select: {
          id: true, approximateArea: true, observedAt: true, createdAt: true,
          broadcast: { select: { id: true, title: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.prisma.communityPost.findMany({
        where: { authorId: userId },
        select: { id: true, title: true, type: true, verificationStatus: true, areaLabel: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.prisma.incidentVerification.findMany({
        where: { verifierId: userId },
        select: { id: true, result: true, method: true, createdAt: true, incident: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.prisma.auditLog.findMany({
        where: { OR: [{ actorUserId: userId }, { entityType: "users", entityId: userId }] },
        include: { actorAdmin: { select: { displayName: true } }, actorUser: { select: { profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.userPushToken.findFirst({
        where: { userId },
        select: { lastSeenAt: true },
        orderBy: { lastSeenAt: "desc" },
      }),
    ]);

    const trusted =
      user.trustedReporter && !user.trustedReporter.revokedAt ? user.trustedReporter : null;
    const latestKyc = user.kycRecords[0] ?? null;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      role: trusted ? UserRole.TrustedReporter : UserRole.Citizen,
      profileComplete: isCitizenProfileComplete(user.profile),
      trustScore: trusted ? Number(trusted.trustScore) : null,
      kycStatus: latestKyc?.status ?? "Unverified",
      kycHistory: user.kycRecords.map((row) => ({
        id: row.id,
        status: row.status,
        documentType: row.documentType,
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
      })),
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            country: user.profile.country || null,
            countryCode: user.profile.countryCode || null,
            preferredLocale: user.profile.preferredLocale || null,
            effectivePreferredLocale: effectivePreferredLocale(user.profile.preferredLocale),
            state: user.profile.state || null,
            lga: user.profile.lga || null,
            community: user.profile.homeCommunity
              ? { id: user.profile.homeCommunity.id, name: user.profile.homeCommunity.name }
              : null,
            avatarUrl: await this.resolveProfileAvatarUrl(user.profile.avatarUrl),
            dateOfBirth: user.profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
            gender: user.profile.gender,
            address: user.profile.address,
          }
        : null,
      emergencyContacts: user.emergencyContacts.map((contact) => this.mapEmergencyContact(contact)),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastActiveAt: lastDeviceActivity?.lastSeenAt?.toISOString() ?? null,
      reports: reports.map((report) => ({
        id: report.id,
        reference: buildIncidentPublicReference({ incidentId: report.id, submittedAt: report.submittedAt }),
        type: report.type,
        title: report.title,
        status: report.status,
        priority: report.priority,
        location: [report.address, report.lga, report.state, report.country].filter(Boolean).join(", "),
        capturedAt: report.submittedAt.toISOString(),
        assignedAgency: report.assignedAgency?.name ?? null,
      })),
      broadcasts: broadcasts.map((broadcast) => ({
        id: broadcast.id,
        reference: `Broadcast ${broadcast.id.slice(0, 8).toUpperCase()}`,
        type: broadcast.type,
        title: broadcast.title,
        status: broadcast.status,
        scope: [broadcast.lga, broadcast.state, broadcast.country].filter(Boolean).join(", ") || "Nationwide",
        createdAt: broadcast.createdAt.toISOString(),
        publishedAt: broadcast.publishedAt?.toISOString() ?? null,
      })),
      sightings: sightings.map((sighting) => ({
        id: sighting.id,
        reference: `Sighting ${sighting.id.slice(0, 8).toUpperCase()}`,
        broadcastId: sighting.broadcast.id,
        relatedBroadcast: sighting.broadcast.title,
        type: sighting.broadcast.type,
        location: sighting.approximateArea ?? null,
        reportedAt: (sighting.observedAt ?? sighting.createdAt).toISOString(),
        reviewStatus: "Submitted",
      })),
      activity: [
        ...communityPosts.map((post) => ({
          id: post.id, category: "Community", label: post.title, detail: `${post.type} · ${post.verificationStatus}`,
          location: post.areaLabel ?? null, createdAt: post.createdAt.toISOString(),
        })),
        ...verifications.map((verification) => ({
          id: verification.id, category: "Verification", label: verification.incident.title,
          detail: `${verification.method} · ${verification.result}`, reportId: verification.incident.id,
          createdAt: verification.createdAt.toISOString(),
        })),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 12),
      auditHistory: auditHistory.map((entry) => ({
        id: entry.id,
        event: entry.action,
        createdAt: entry.createdAt.toISOString(),
        actor: entry.actorAdmin?.displayName
          || [entry.actorUser?.profile?.firstName, entry.actorUser?.profile?.lastName].filter(Boolean).join(" ")
          || (entry.actorType === "system" ? "System" : "Account user"),
        reason: entry.reason ?? null,
        beforeStatus: this.auditStateValue(entry.beforeState, "status"),
        afterStatus: this.auditStateValue(entry.afterState, "status"),
      })),
    };
  }

  async updateCitizenAccountStatus(actor: JwtPayload, userId: string, dto: UpdateUserAccountStatusDto) {
    this.assertAdminWithUserManage(actor);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException("User not found");
    this.assertCitizenInAdminScope(actor, user.profile);
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException("A reason is required");
    if (user.status === dto.status) throw new ConflictException(`Account is already ${dto.status.toLowerCase()}`);

    const allowed = user.status === "Active"
      ? ["Suspended", "Deactivated"]
      : user.status === "Suspended"
        ? ["Active", "Deactivated"]
        : ["Active"];
    if (!allowed.includes(dto.status)) throw new ConflictException("Account status transition is not allowed");

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: dto.status as never } }),
      ...(dto.status === "Active" ? [] : [
        this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        this.prisma.userPushToken.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }),
      ]),
    ]);
    await this.audit.record({
      actor,
      action: dto.status === "Active" ? "account.reactivated" : dto.status === "Suspended" ? "account.suspended" : "account.deactivated",
      entityType: "users",
      entityId: userId,
      reason,
      beforeState: { status: user.status },
      afterState: { status: dto.status },
    });
    return { data: { id: userId, status: dto.status } };
  }

  async requestAccountDeletion(actor: JwtPayload, confirm: boolean) {
    this.assertCitizen(actor);
    if (!confirm) {
      throw new BadRequestException("Confirm account deletion to continue");
    }
    // Policy/retention not finalized: deactivate account and revoke sessions only.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: actor.sub },
        data: { status: "Deactivated" },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: actor.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.userPushToken.updateMany({
        where: { userId: actor.sub, isActive: true },
        data: { isActive: false },
      }),
    ]);

    await this.audit.record({
      actor,
      action: "account.deactivated",
      entityType: "users",
      entityId: actor.sub,
      metadata: { mode: "self_request" },
    });

    return {
      ok: true,
      status: "Deactivated",
      message:
        "Your account has been deactivated. Full erasure remains subject to legal retention requirements.",
    };
  }

  async listDirectory(
    actor: JwtPayload,
    query: CursorPageQuery & {
      q?: string;
      searchType?: string;
      searchBy?: string;
      status?: string;
      role?: string;
      kind?: string;
      country?: string;
      state?: string;
      lga?: string;
      communityId?: string;
    } = {},
  ) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can list users");

    const limit = resolvePageLimit(query.limit);
    if (query.cursor?.trim() && !decodeDateIdCursor(query.cursor)) {
      throw new BadRequestException("cursor is invalid");
    }
    const cursor = decodeDateIdCursor(query.cursor);
    const take = limit + 1;
    const textFilter = this.buildDirectoryTextFilter(query.q, query.searchType, query.searchBy);
    const adminScope = this.adminScopeWhere(actor) as Record<string, unknown>;
    const citizenScope = this.citizenScopeWhere(actor) as { profile?: { is?: Record<string, unknown> }; [key: string]: unknown };
    const citizenProfileFilter = {
      ...(citizenScope.profile?.is ?? {}),
      ...(query.country ? { country: query.country } : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.lga ? { lga: query.lga } : {}),
      ...(query.communityId ? { homeCommunityId: query.communityId } : {}),
    };
    const adminWhere = {
      ...adminScope,
      ...dateIdCursorWhere(cursor),
      ...(query.status === "active" ? { isActive: true } : query.status === "deactivated" ? { isActive: false } : {}),
      ...(query.status === "suspended" || query.communityId ? { id: "__deny_all__" } : {}),
      ...(query.role ? { role: { name: query.role } } : {}),
      ...(query.country ? { country: query.country } : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.lga ? { lga: query.lga } : {}),
      ...textFilter.admin,
    } as never;
    const citizenWhere = {
      ...citizenScope,
      ...(Object.keys(citizenProfileFilter).length ? { profile: { is: citizenProfileFilter } } : {}),
      ...dateIdCursorWhere(cursor),
      ...(query.status === "active"
        ? { status: "Active" as const }
        : query.status === "suspended"
          ? { status: "Suspended" as const }
          : query.status === "deactivated"
            ? { status: "Deactivated" as const }
            : {}),
      ...textFilter.citizen,
    } as never;

    const adminsPromise = query.kind === "citizen"
      ? Promise.resolve([])
      : this.prisma.adminUser.findMany({
          where: adminWhere,
          include: { role: true, agency: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
        });
    const citizensPromise = query.kind === "admin"
      ? Promise.resolve([])
      : this.prisma.user.findMany({
          where: citizenWhere,
          include: {
            profile: { include: { homeCommunity: { select: { name: true } } } },
            trustedReporter: true,
            kycRecords: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
        });
    const [admins, citizens, totalAdmins, totalCitizens, activeAdmins, activeCitizens, pendingCitizens, deactivatedAdmins, deactivatedCitizens] = await Promise.all([
      adminsPromise,
      citizensPromise,
      this.prisma.adminUser.count({ where: this.adminScopeWhere(actor) as never }),
      this.prisma.user.count({ where: this.citizenScopeWhere(actor) as never }),
      this.prisma.adminUser.count({ where: { ...this.adminScopeWhere(actor), isActive: true } as never }),
      this.prisma.user.count({ where: { ...this.citizenScopeWhere(actor), status: "Active" } as never }),
      this.prisma.user.count({ where: { ...this.citizenScopeWhere(actor), kycRecords: { some: { status: "Pending" } } } as never }),
      this.prisma.adminUser.count({ where: { ...this.adminScopeWhere(actor), isActive: false } as never }),
      this.prisma.user.count({ where: { ...this.citizenScopeWhere(actor), status: "Deactivated" } as never }),
    ]);

    const merged: DirectoryRow[] = [
      ...admins.map((admin) => ({
        id: admin.id,
        createdAt: admin.createdAt,
        kind: "admin" as const,
        name: admin.displayName,
        email: admin.email,
        role: admin.role.name,
        status: admin.isActive ? "Active" : "Deactivated",
        scope: [admin.country, admin.state, admin.lga].filter(Boolean).join(" / ") || "Global",
        agency: admin.agency?.name ?? null,
      })),
      ...citizens.map((user) => ({
        id: user.id,
        createdAt: user.createdAt,
        kind: "citizen" as const,
        name: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || user.email,
        email: user.email,
        role: user.trustedReporter ? "Trusted Reporter" : "Citizen",
        status: String(user.status),
        scope: [user.profile?.country, user.profile?.state, user.profile?.lga, user.profile?.homeCommunity?.name].filter(Boolean).join(" / ") || "None / Not assigned",
        agency: null,
      })),
    ].sort((left, right) => {
      const byDate = right.createdAt.getTime() - left.createdAt.getTime();
      if (byDate !== 0) return byDate;
      return right.id.localeCompare(left.id);
    });

    const page = buildCursorPage(merged, limit, (item) => encodeDateIdCursor(item.createdAt, item.id));
    return {
      ...page,
      data: page.data.map(({ createdAt: _createdAt, kind: _kind, agency, ...entry }) => entry),
      meta: {
        totalUsers: totalAdmins + totalCitizens,
        activeUsers: activeAdmins + activeCitizens,
        pendingUsers: pendingCitizens,
        deactivatedUsers: deactivatedAdmins + deactivatedCitizens,
      },
    };
  }

  async listDirectoryOptions(actor: JwtPayload) {
    this.assertAdminWithUserManage(actor);
    const geographyWhere = this.adminJurisdictionWhere(actor);
    const [jurisdictions, communities] = await Promise.all([
      this.prisma.jurisdiction.findMany({
        where: { ...geographyWhere, NOT: [{ state: "All" }, { lga: "All" }] },
        orderBy: [{ country: "asc" }, { state: "asc" }, { lga: "asc" }],
        select: { id: true, country: true, state: true, lga: true, name: true },
      }),
      this.prisma.community.findMany({
        where: { ...geographyWhere, status: "Active" as never },
        orderBy: [{ country: "asc" }, { state: "asc" }, { lga: "asc" }, { name: "asc" }],
        select: { id: true, jurisdictionId: true, name: true, level: true, country: true, state: true, lga: true },
      }),
    ]);
    return { data: { jurisdictions, communities } };
  }

  async getAdminAccountOptions(actor: JwtPayload) {
    this.assertAdminWithUserManage(actor);
    const accountTypes = this.creatableOperationalAccountTypes(actor);
    const geographyWhere = this.adminJurisdictionWhere(actor);
    const agencyWhere = this.adminAgencyWhere(actor);
    const [jurisdictions, agencies] = await Promise.all([
      this.prisma.jurisdiction.findMany({
        where: geographyWhere,
        select: { id: true, country: true, state: true, lga: true, name: true },
        orderBy: [{ country: "asc" }, { state: "asc" }, { lga: "asc" }],
        take: 500,
      }),
      this.prisma.agency.findMany({
        where: { ...agencyWhere, isActive: true, isFieldOperationsEnabled: true },
        select: {
          id: true,
          name: true,
          countryCode: true,
          stateCode: true,
          lgaCode: true,
          jurisdictionId: true,
        },
        orderBy: { name: "asc" },
        take: 500,
      }),
    ]);
    return { data: { accountTypes, jurisdictions, agencies } };
  }

  async createOperationalAdmin(actor: JwtPayload, dto: CreateOperationalAdminDto) {
    this.assertAdminWithUserManage(actor);
    const allowedTypes = this.creatableOperationalAccountTypes(actor);
    if (!allowedTypes.includes(dto.accountType)) {
      throw new ForbiddenException("You cannot create this account type");
    }

    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    const existing = await this.prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException("An account with this email already exists");

    let roleName: AdminRoleName;
    let agencyId: string | null = null;
    let jurisdiction: { id: string; country: string; state: string; lga: string };

    if (dto.accountType === "field_officer") {
      if (!dto.agencyId) throw new BadRequestException("agencyId is required for a field officer");
      const agency = await this.prisma.agency.findUnique({
        where: { id: dto.agencyId },
        include: { jurisdiction: true },
      });
      if (!agency?.isActive || !agency.isFieldOperationsEnabled || !agency.jurisdiction) {
        throw new BadRequestException("Select an active field-operations agency with a jurisdiction");
      }
      jurisdiction = agency.jurisdiction;
      agencyId = agency.id;
      roleName = AdminRoleName.PoliceSecurityOfficer;
      if (actor.role === AdminRoleName.AgencyAdmin && actor.agencyId !== agency.id) {
        throw new ForbiddenException("Agency Admin cannot create an officer for another agency");
      }
    } else {
      if (!dto.jurisdictionId) throw new BadRequestException("jurisdictionId is required for an LGA Admin");
      const selected = await this.prisma.jurisdiction.findUnique({ where: { id: dto.jurisdictionId } });
      if (!selected || !selected.lga || selected.lga === "All") {
        throw new BadRequestException("Select a specific LGA jurisdiction");
      }
      jurisdiction = selected;
      roleName = AdminRoleName.LgaAdmin;
    }

    if (!adminCanAccessGeography(jurisdiction, actor)) {
      throw new ForbiddenException("Selected jurisdiction is outside your admin scope");
    }
    const role = await this.prisma.adminRole.findUnique({ where: { name: roleName } });
    if (!role) throw new ServiceUnavailableException(`Required role is not configured: ${roleName}`);

    let created;
    try {
      created = await this.prisma.adminUser.create({
        data: {
          email,
          passwordHash: hashPassword(dto.password),
          displayName,
          roleId: role.id,
          agencyId,
          jurisdictionId: jurisdiction.id,
          country: jurisdiction.country,
          state: jurisdiction.state,
          lga: jurisdiction.lga,
          isActive: true,
        },
        include: { role: true, agency: true },
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }

    await this.audit.record({
      actor,
      action: "admin.account.created",
      entityType: "admin_user",
      entityId: created.id,
      metadata: { accountType: dto.accountType, role: roleName, jurisdictionId: jurisdiction.id, agencyId },
    });

    return {
      data: {
        id: created.id,
        email: created.email,
        displayName: created.displayName,
        role: created.role.name,
        agencyId: created.agencyId,
        agencyName: created.agency?.name ?? null,
        jurisdictionId: created.jurisdictionId,
        scope: [created.country, created.state, created.lga].filter(Boolean).join(" / "),
        isActive: created.isActive,
      },
    };
  }

  private async buildCitizenProfileResponse(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        trustedReporter: true,
        kycRecords: { orderBy: { createdAt: "desc" }, take: 1 },
        emergencyContacts: { orderBy: { priority: "asc" } },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    const trusted =
      user.trustedReporter && !user.trustedReporter.revokedAt ? user.trustedReporter : null;
    const latestKyc = user.kycRecords[0] ?? null;
    const primaryContact = user.emergencyContacts[0] ?? null;
    const displayName =
      [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ").trim() ||
      user.email ||
      user.phone ||
      "Citizen";

    return {
      id: user.id,
      typ: "user" as const,
      email: user.email,
      phone: user.phone,
      role: trusted ? UserRole.TrustedReporter : UserRole.Citizen,
      status: user.status,
      displayName,
      profileComplete: isCitizenProfileComplete(user.profile),
      kycStatus: latestKyc?.status ?? "Unverified",
      kycRejectionReason: latestKyc?.status === "Rejected" ? latestKyc.rejectionReason : null,
      trustScore: trusted ? Number(trusted.trustScore) : null,
      emergencyContact: primaryContact
        ? {
            id: primaryContact.id,
            name: primaryContact.name,
            phone: primaryContact.phone,
            relationship: primaryContact.relationship,
            priority: primaryContact.priority,
          }
        : null,
      emergencyContacts: user.emergencyContacts.map((contact) => this.mapEmergencyContact(contact)),
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            country: user.profile.country || null,
            countryCode: user.profile.countryCode || null,
            preferredLocale: user.profile.preferredLocale || null,
            effectivePreferredLocale: effectivePreferredLocale(user.profile.preferredLocale),
            state: user.profile.state || null,
            lga: user.profile.lga || null,
            avatarUrl: await this.resolveProfileAvatarUrl(user.profile.avatarUrl),
            dateOfBirth: user.profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
            gender: user.profile.gender,
            address: user.profile.address,
          }
        : null,
      profileJurisdiction: user.profile
        ? {
            country: user.profile.country || null,
            countryCode: user.profile.countryCode || null,
            state: user.profile.state || null,
            lga: user.profile.lga || null,
            source: "user_profile",
            isProfileFallback: true,
          }
        : null,
      deviceLocation: {
        status: "unavailable",
        source: "unavailable",
      },
      preferredLocale: user.profile?.preferredLocale ?? null,
      effectivePreferredLocale: effectivePreferredLocale(user.profile?.preferredLocale),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async getAdminDetail(actor: JwtPayload, adminId: string) {
    this.assertAdminWithUserManage(actor);
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId, ...this.adminScopeWhere(actor) },
      include: { role: true, agency: true },
    });
    if (!admin) throw new NotFoundException("Admin account not found");

    const [auditHistory, lastSession] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { OR: [{ actorAdminId: adminId }, { entityType: "admin_user", entityId: adminId }] },
        include: { actorAdmin: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.refreshToken.findFirst({ where: { adminUserId: adminId }, select: { createdAt: true }, orderBy: { createdAt: "desc" } }),
    ]);

    return {
      id: admin.id,
      typ: "admin" as const,
      displayName: admin.displayName,
      email: admin.email,
      role: admin.role.name,
      status: admin.isActive ? "Active" : "Deactivated",
      scope: [admin.country, admin.state, admin.lga].filter(Boolean).join(" / ") || "Global",
      agency: admin.agency?.name ?? null,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
      lastActiveAt: lastSession?.createdAt?.toISOString() ?? null,
      canManageStatus: actor.sub !== admin.id,
      auditHistory: auditHistory.map((entry) => ({
        id: entry.id,
        event: entry.action,
        createdAt: entry.createdAt.toISOString(),
        actor: entry.actorAdmin?.displayName ?? (entry.actorType === "system" ? "System" : "Administrator"),
        reason: entry.reason ?? null,
        beforeStatus: this.auditStateValue(entry.beforeState, "status"),
        afterStatus: this.auditStateValue(entry.afterState, "status"),
      })),
    };
  }

  async updateAdminAccountStatus(actor: JwtPayload, adminId: string, dto: UpdateUserAccountStatusDto) {
    this.assertAdminWithUserManage(actor);
    if (actor.sub === adminId) throw new ForbiddenException("You cannot change your own account status");
    if (dto.status === "Suspended") throw new BadRequestException("Operational accounts support Active or Deactivated status");
    const admin = await this.prisma.adminUser.findFirst({ where: { id: adminId, ...this.adminScopeWhere(actor) } });
    if (!admin) throw new NotFoundException("Admin account not found");
    const currentStatus = admin.isActive ? "Active" : "Deactivated";
    if (currentStatus === dto.status) throw new ConflictException(`Account is already ${dto.status.toLowerCase()}`);
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException("A reason is required");

    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id: adminId }, data: { isActive: dto.status === "Active" } }),
      ...(dto.status === "Active" ? [] : [
        this.prisma.refreshToken.updateMany({ where: { adminUserId: adminId, revokedAt: null }, data: { revokedAt: new Date() } }),
      ]),
    ]);
    await this.audit.record({
      actor,
      action: dto.status === "Active" ? "admin.account.reactivated" : "admin.account.deactivated",
      entityType: "admin_user",
      entityId: adminId,
      reason,
      beforeState: { status: currentStatus },
      afterState: { status: dto.status },
    });
    return { data: { id: adminId, status: dto.status } };
  }

  private auditStateValue(value: Prisma.JsonValue | null, key: string) {
    if (!value || Array.isArray(value) || typeof value !== "object") return null;
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean"
      ? String(candidate)
      : null;
  }

  private async resolveProfileAvatarUrl(value?: string | null) {
    if (!value) return value ?? null;
    const match = value.match(/^storage:\/\/([^/]+)\/(.+)$/);
    if (!match) return value;
    try {
      if (match[1] !== getConfiguredStorageBucket()) return null;
      return (await createStorageDownloadUrl(match[2], 300)).url;
    } catch {
      return null;
    }
  }

  private mapEmergencyContact(contact: {
    id: string;
    name: string;
    phone: string;
    relationship: string;
    priority: number;
  }) {
    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      priority: contact.priority,
    };
  }

  private async mapCitizenVehicle(vehicle: CitizenVehicle | CitizenVehicleWithPhotos) {
    const photos = "photos" in vehicle
      ? await Promise.all(vehicle.photos.map((photo) => this.mapCitizenVehiclePhoto(photo)))
      : [];
    return {
      id: vehicle.id,
      userId: vehicle.userId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      plateNumber: vehicle.plateNumber,
      vin: vehicle.vin,
      isPrimary: vehicle.isPrimary,
      photos,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
    };
  }

  private async mapCitizenVehiclePhoto(photo: CitizenVehiclePhoto) {
    return {
      id: photo.id,
      objectKey: photo.objectKey,
      contentType: photo.contentType,
      angle: photo.angle,
      sizeBytes: photo.sizeBytes,
      sortOrder: photo.sortOrder,
      createdAt: photo.createdAt.toISOString(),
      signedGetUrl: await this.tryCreateSignedGetUrl(photo.objectKey),
    };
  }

  private async tryCreateSignedGetUrl(objectKey: string): Promise<string | null> {
    try {
      return (await createStorageDownloadUrl(objectKey, 300)).url;
    } catch {
      return null;
    }
  }

  private toCitizenVehicleCreateInput(dto: CreateCitizenVehicleDto): {
    make: string;
    model: string;
    plateNumber: string;
    year: number | null;
    color: string | null;
    vin: string | null;
    isPrimary: boolean;
  } {
    return {
      make: this.normalizeRequiredVehicleText(dto.make, "Make is required"),
      model: this.normalizeRequiredVehicleText(dto.model, "Model is required"),
      plateNumber: this.normalizePlateNumber(dto.plateNumber),
      year: dto.year ?? null,
      color: dto.color?.trim() || null,
      vin: dto.vin?.trim() || null,
      isPrimary: dto.isPrimary ?? false,
    };
  }

  private toCitizenVehicleUpdateInput(dto: UpdateCitizenVehicleDto): Prisma.CitizenVehicleUncheckedUpdateInput {
    const data: Prisma.CitizenVehicleUncheckedUpdateInput = {};
    if (dto.make !== undefined) data.make = this.normalizeRequiredVehicleText(dto.make, "Make is required");
    if (dto.model !== undefined) data.model = this.normalizeRequiredVehicleText(dto.model, "Model is required");
    if (dto.plateNumber !== undefined) data.plateNumber = this.normalizePlateNumber(dto.plateNumber);
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.color !== undefined) data.color = dto.color?.trim() || null;
    if (dto.vin !== undefined) data.vin = dto.vin?.trim() || null;
    return data;
  }

  private normalizePlateNumber(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) throw new BadRequestException("Plate number is required");
    return normalized;
  }

  private normalizeRequiredVehicleText(value: string, message: string) {
    const normalized = value.trim();
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private rethrowCitizenVehicleWriteError(error: unknown): never {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      throw new ConflictException("A vehicle with this plate number already exists in your garage");
    }
    throw error;
  }

  private assertCitizen(actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen authentication required");
  }

  private assertAdminWithUserManage(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
    if (!actor.permissions?.includes("user:manage")) {
      throw new ForbiddenException("Missing permission: user:manage");
    }
  }

  private creatableOperationalAccountTypes(actor: JwtPayload): Array<"field_officer" | "lga_admin"> {
    if ([AdminRoleName.SuperAdmin, AdminRoleName.CountryAdmin, AdminRoleName.StateAdmin].includes(actor.role as AdminRoleName)) {
      return ["field_officer", "lga_admin"];
    }
    if ([AdminRoleName.LgaAdmin, AdminRoleName.AgencyAdmin].includes(actor.role as AdminRoleName)) {
      return ["field_officer"];
    }
    return [];
  }

  private adminJurisdictionWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country };
    if (actor.role === AdminRoleName.StateAdmin) return { country: actor.country, state: actor.state };
    return { country: actor.country, state: actor.state, lga: actor.lga };
  }

  private adminAgencyWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.AgencyAdmin) return { id: actor.agencyId ?? "__no_agency__" };
    if (actor.role === AdminRoleName.CountryAdmin) {
      return { jurisdiction: { is: { country: actor.country } } };
    }
    if (actor.role === AdminRoleName.StateAdmin) {
      return { jurisdiction: { is: { country: actor.country, state: actor.state } } };
    }
    return { jurisdiction: { is: { country: actor.country, state: actor.state, lga: actor.lga } } };
  }

  private assertCitizenInAdminScope(
    actor: JwtPayload,
    profile: { country: string; state: string; lga: string } | null,
  ) {
    if (actor.role === AdminRoleName.SuperAdmin) return;
    if (!profile) throw new ForbiddenException("Citizen is outside your jurisdiction");
    if (actor.role === AdminRoleName.CountryAdmin && profile.country !== actor.country) {
      throw new ForbiddenException("Citizen is outside your jurisdiction");
    }
    if (
      actor.role === AdminRoleName.StateAdmin &&
      (profile.country !== actor.country || profile.state !== actor.state)
    ) {
      throw new ForbiddenException("Citizen is outside your jurisdiction");
    }
    if (
      (actor.role === AdminRoleName.LgaAdmin ||
        actor.role === AdminRoleName.CallCenterAgent ||
        actor.role === AdminRoleName.OversightAuditor) &&
      (profile.country !== actor.country || profile.state !== actor.state || profile.lga !== actor.lga)
    ) {
      throw new ForbiddenException("Citizen is outside your jurisdiction");
    }
  }

  private adminScopeWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { country: actor.country };
    if (actor.role === AdminRoleName.StateAdmin) return { country: actor.country, state: actor.state };
    if (
      actor.role === AdminRoleName.LgaAdmin ||
      actor.role === AdminRoleName.CallCenterAgent ||
      actor.role === AdminRoleName.OversightAuditor
    ) {
      return { country: actor.country, state: actor.state, lga: actor.lga };
    }
    if (actor.role === AdminRoleName.AgencyAdmin || actor.role === AdminRoleName.PoliceSecurityOfficer) {
      return { agencyId: actor.agencyId ?? "__no_agency__" };
    }
    return { id: "__deny_all__" };
  }

  private citizenScopeWhere(actor: JwtPayload) {
    if (actor.role === AdminRoleName.SuperAdmin) return {};
    if (actor.role === AdminRoleName.CountryAdmin) return { profile: { is: { country: actor.country } } };
    if (actor.role === AdminRoleName.StateAdmin) {
      return { profile: { is: { country: actor.country, state: actor.state } } };
    }
    if (
      actor.role === AdminRoleName.LgaAdmin ||
      actor.role === AdminRoleName.CallCenterAgent ||
      actor.role === AdminRoleName.OversightAuditor
    ) {
      return { profile: { is: { country: actor.country, state: actor.state, lga: actor.lga } } };
    }
    return { id: "__deny_all__" };
  }

  private buildDirectoryTextFilter(q?: string, searchType?: string, searchBy?: string) {
    const term = q?.trim();
    if (!term) return { admin: {}, citizen: {} };
    const mode = searchType === "exact" ? undefined : ("insensitive" as const);
    const startsWith = searchType === "startsWith";
    const contains = !searchType || searchType === "contains" || searchType === "advanced";

    const stringFilter = (value: string): string | { startsWith: string; mode: "insensitive" } | { contains: string; mode: "insensitive" } => {
      if (searchType === "exact") return value;
      if (startsWith) return { startsWith: value, mode: "insensitive" };
      if (contains) return { contains: value, mode: "insensitive" };
      return { contains: value, mode: "insensitive" };
    };

    const by = searchBy ?? "all";
    if (by === "email") {
      return {
        admin: { email: stringFilter(term) },
        citizen: { email: stringFilter(term) },
      };
    }
    if (by === "phone") {
      return { admin: { id: "__deny_all__" }, citizen: { phone: stringFilter(term) } };
    }
    if (by === "userId") {
      return { admin: { id: term }, citizen: { id: term } };
    }
    if (by === "role") {
      return { admin: { role: { name: stringFilter(term) } }, citizen: { id: "__deny_all__" } };
    }
    if (by === "all") {
      const idFilter = UUID_PATTERN.test(term) ? [{ id: term }] : [];
      const nameTerms = searchType === "exact"
        ? []
        : term.split(/\s+/).filter(Boolean);
      const fullNameFilter = nameTerms.length > 1
        ? [{
            AND: nameTerms.map((nameTerm) => ({
              OR: [
                { profile: { is: { firstName: stringFilter(nameTerm) } } },
                { profile: { is: { lastName: stringFilter(nameTerm) } } },
              ],
            })),
          }]
        : [];
      return {
        admin: { OR: [{ displayName: stringFilter(term) }, { email: stringFilter(term) }, ...idFilter] },
        citizen: {
          OR: [
            { email: stringFilter(term) },
            { phone: stringFilter(term) },
            { profile: { is: { firstName: stringFilter(term) } } },
            { profile: { is: { lastName: stringFilter(term) } } },
            ...fullNameFilter,
            ...idFilter,
          ],
        },
      };
    }
    return {
      admin: { displayName: stringFilter(term) },
      citizen: {
        OR: [
          { email: stringFilter(term) },
          { profile: { is: { firstName: stringFilter(term) } } },
          { profile: { is: { lastName: stringFilter(term) } } },
        ],
      },
    };
  }
}
