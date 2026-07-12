import { ForbiddenException, Injectable } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  type CursorPageQuery,
} from "../../common/pagination/cursor-pagination";
import { PrismaService } from "../prisma/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

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
    if (actor.role === AdminRoleName.StateAdmin) return { profile: { is: { country: actor.country, state: actor.state } } };
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
