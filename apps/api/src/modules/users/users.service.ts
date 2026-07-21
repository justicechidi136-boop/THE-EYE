import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { AdminRoleName, UserRole } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
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
  avatarObjectKey,
  createS3PresignedPutUrl,
  validateAvatarUpload,
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
  UpsertEmergencyContactDto,
} from "./dto/users.dto";
import { incompleteProfileLocation, isCitizenProfileComplete } from "./profile-complete";

const MAX_EMERGENCY_CONTACTS = 5;

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

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(actor: JwtPayload) {
    if (actor.typ === "admin") {
      return {
        id: actor.sub,
        typ: actor.typ,
        email: actor.email ?? null,
        role: actor.role,
        permissions: actor.permissions ?? [],
        country: actor.country ?? null,
        state: actor.state ?? null,
        lga: actor.lga ?? null,
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
          state: nextProfile.state,
          lga: nextProfile.lga,
        },
        update: {
          firstName: nextProfile.firstName,
          lastName: nextProfile.lastName,
          country: nextProfile.country,
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

  async presignAvatar(actor: JwtPayload, dto: AvatarPresignDto) {
    this.assertCitizen(actor);
    validateAvatarUpload(dto.contentType, dto.sizeBytes);
    const objectKey = avatarObjectKey(actor.sub, dto.fileName);
    try {
      const uploadUrl = createS3PresignedPutUrl(objectKey, 900, dto.contentType);
      return {
        bucket: process.env.S3_BUCKET ?? "the-eye",
        objectKey,
        uploadUrl,
        requiredHeaders: { "content-type": dto.contentType },
        expiresInSeconds: 900,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Avatar storage is not configured");
    }
  }

  async confirmAvatar(actor: JwtPayload, dto: AvatarConfirmDto) {
    this.assertCitizen(actor);
    assertAvatarObjectKey(actor.sub, dto.objectKey, dto.bucket, dto.contentType);

    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET ?? "the-eye";
    if (!endpoint) throw new ServiceUnavailableException("Avatar storage is not configured");

    const avatarUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${dto.objectKey}`;
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
        profile: true,
        trustedReporter: true,
        kycRecords: { orderBy: { createdAt: "desc" }, take: 5 },
        emergencyContacts: { orderBy: { priority: "asc" } },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    this.assertCitizenInAdminScope(actor, user.profile);

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
            state: user.profile.state || null,
            lga: user.profile.lga || null,
            avatarUrl: user.profile.avatarUrl,
            dateOfBirth: user.profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
            gender: user.profile.gender,
            address: user.profile.address,
          }
        : null,
      emergencyContacts: user.emergencyContacts.map((contact) => this.mapEmergencyContact(contact)),
    };
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

  async listDirectory(actor: JwtPayload, query: CursorPageQuery = {}) {
    if (actor.typ !== "admin") throw new ForbiddenException("Only admins can list users");

    const limit = resolvePageLimit(query.limit);
    const cursor = decodeDateIdCursor(query.cursor);
    const take = limit + 1;
    const adminWhere = { ...this.adminScopeWhere(actor), ...dateIdCursorWhere(cursor) };
    const citizenWhere = { ...this.citizenScopeWhere(actor), ...dateIdCursorWhere(cursor) };

    const [admins, citizens] = await Promise.all([
      this.prisma.adminUser.findMany({
        where: adminWhere,
        include: { role: true, agency: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
      }),
      this.prisma.user.findMany({
        where: citizenWhere,
        include: {
          profile: true,
          trustedReporter: true,
          kycRecords: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
      }),
    ]);

    const merged: DirectoryRow[] = [
      ...admins.map((admin) => ({
        id: admin.id,
        createdAt: admin.createdAt,
        kind: "admin" as const,
        name: admin.displayName,
        email: admin.email,
        role: admin.role.name,
        status: admin.isActive ? "Active" : "Inactive",
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
        status: String(user.kycRecords[0]?.status ?? (user.status === "Active" ? "Active" : user.status)),
        scope: [user.profile?.lga, user.profile?.state].filter(Boolean).join(", ") || "Unscoped",
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
            state: user.profile.state || null,
            lga: user.profile.lga || null,
            avatarUrl: user.profile.avatarUrl,
            dateOfBirth: user.profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
            gender: user.profile.gender,
            address: user.profile.address,
          }
        : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
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

  private assertCitizen(actor: JwtPayload) {
    if (actor.typ !== "user") throw new ForbiddenException("Citizen authentication required");
  }

  private assertAdminWithUserManage(actor: JwtPayload) {
    if (actor.typ !== "admin") throw new ForbiddenException("Admin authentication required");
    if (!actor.permissions?.includes("user:manage")) {
      throw new ForbiddenException("Missing permission: user:manage");
    }
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
}
