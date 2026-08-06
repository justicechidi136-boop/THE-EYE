import { UnauthorizedException } from "@nestjs/common";
import { AdminRoleName, UserRole, adminRolePermissions, userRolePermissions } from "@the-eye/shared";
import type { PrismaService } from "../../modules/prisma/prisma.service";
import { getCachedAuthUser, setCachedAuthUser } from "./auth-user-cache";
import type { JwtPayload } from "./jwt";

export async function resolveAuthenticatedUser(prisma: PrismaService, payload: JwtPayload): Promise<JwtPayload> {
  const cached = getCachedAuthUser(payload);
  if (cached) return cached;
  if (payload.typ === "field") {
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!admin || !admin.isActive) throw new UnauthorizedException("Officer account is inactive or missing");
    if (!payload.fieldDeviceId || !payload.sessionId) throw new UnauthorizedException("Invalid field session");
    const device = await prisma.fieldDevice.findUnique({ where: { id: payload.fieldDeviceId } });
    if (!device || device.isRevoked || device.isLost || device.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException("Field device no longer authorized");
    }
    const session = await prisma.fieldDeviceSession.findFirst({
      where: { sessionId: payload.sessionId, fieldDeviceId: device.id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!session) throw new UnauthorizedException("Field session expired");
    const role = admin.role.name as AdminRoleName;
    const resolved: JwtPayload = {
      sub: admin.id,
      typ: "field",
      email: admin.email,
      role,
      fieldRole: payload.fieldRole,
      permissions: payload.permissions ?? adminRolePermissions[role],
      country: admin.country,
      state: admin.state,
      lga: admin.lga,
      agencyId: admin.agencyId ?? undefined,
      jurisdictionId: admin.jurisdictionId,
      fieldDeviceId: device.id,
      assignedUnitId: device.assignedUnitId ?? undefined,
      sessionId: payload.sessionId,
      tokenVersion: payload.tokenVersion,
      authMode: payload.authMode,
    };
    setCachedAuthUser(payload, resolved);
    return resolved;
  }
  if (payload.typ === "admin") {
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!admin || !admin.isActive) throw new UnauthorizedException("Admin account is inactive or missing");
    const role = admin.role.name as AdminRoleName;
    const resolved: JwtPayload = {
      sub: admin.id,
      typ: "admin",
      email: admin.email,
      role,
      permissions: adminRolePermissions[role],
      country: admin.country,
      state: admin.state,
      lga: admin.lga,
      agencyId: admin.agencyId ?? undefined,
      jurisdictionId: admin.jurisdictionId,
    };
    setCachedAuthUser(payload, resolved);
    return resolved;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { trustedReporter: true },
  });
  if (!user || user.status !== "Active") throw new UnauthorizedException("User account is inactive or missing");
  const role = user.trustedReporter && !user.trustedReporter.revokedAt ? UserRole.TrustedReporter : UserRole.Citizen;
  const resolved: JwtPayload = {
    sub: user.id,
    typ: "user",
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    role,
    permissions: userRolePermissions[role],
  };
  setCachedAuthUser(payload, resolved);
  return resolved;
}
