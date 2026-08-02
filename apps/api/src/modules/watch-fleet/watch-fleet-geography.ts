import { WatchOwnerType } from "@the-eye/shared";
import type { GeographyScope } from "../../common/auth/admin-geography-scope";

/** Prisma `where` clause restricting devices to an admin geography scope. */
export function buildGeographyDeviceWhere(scope: GeographyScope | null): Record<string, unknown> | undefined {
  if (!scope || (!scope.country && !scope.state && !scope.lga)) return undefined;

  const profileWhere: Record<string, unknown> = {};
  if (scope.country) profileWhere.country = scope.country;
  if (scope.state) profileWhere.state = scope.state;
  if (scope.lga) profileWhere.lga = scope.lga;

  const orgWhere = { ...profileWhere };

  return {
    OR: [
      { currentOwnerType: WatchOwnerType.UnassignedInventory },
      {
        currentOwnerType: WatchOwnerType.Person,
        user: { profile: profileWhere },
      },
      {
        currentOwnerType: WatchOwnerType.Organization,
        currentOrganization: orgWhere,
      },
    ],
  };
}

export type OwnerSummaryCursor = {
  total: number;
  ownerType: string;
  ownerId: string;
};

export function encodeOwnerSummaryCursor(total: number, ownerType: string, ownerId: string | null) {
  return Buffer.from(
    JSON.stringify({ total, ownerType, ownerId: ownerId ?? "none" }),
    "utf8",
  ).toString("base64url");
}

export function decodeOwnerSummaryCursor(cursor?: string): OwnerSummaryCursor | null {
  if (!cursor?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as OwnerSummaryCursor;
    if (parsed?.ownerType == null || parsed.total == null) return null;
    return {
      total: Number(parsed.total),
      ownerType: String(parsed.ownerType),
      ownerId: String(parsed.ownerId ?? "none"),
    };
  } catch {
    return null;
  }
}
