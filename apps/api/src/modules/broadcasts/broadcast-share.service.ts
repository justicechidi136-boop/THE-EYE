import { Injectable, NotFoundException } from "@nestjs/common";
import { BroadcastStatus, BroadcastType } from "@the-eye/shared";
import { maskRegistrationNumber } from "./dto/citizen-broadcast.dto";
import { PrismaService } from "../prisma/prisma.service";

const PUBLIC_STATUSES = new Set<string>([
  BroadcastStatus.Published,
  BroadcastStatus.Active,
  BroadcastStatus.Updated,
  BroadcastStatus.Resolved,
  BroadcastStatus.Suspended,
  BroadcastStatus.WithdrawnByAuthor,
  BroadcastStatus.Expired,
]);

@Injectable()
export class BroadcastShareService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicShare(id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, deletedAt: null },
    });
    if (!broadcast || broadcast.status === BroadcastStatus.DeletedByAdmin) {
      throw new NotFoundException("Broadcast not available");
    }
    if (!PUBLIC_STATUSES.has(String(broadcast.status))) {
      throw new NotFoundException("Broadcast not available");
    }

    const metadata = (broadcast.metadata as Record<string, unknown> | null) ?? {};
    const authorType = String(broadcast.authorType ?? "Admin");
    const authorLabel =
      authorType === "Citizen"
        ? broadcast.adminVerified
          ? "Verified by Admin"
          : "Citizen Broadcast"
        : broadcast.adminVerified
          ? "Verified by Admin"
          : "Admin Broadcast";

    return {
      data: {
        id: broadcast.id,
        type: broadcast.type,
        status: broadcast.status,
        title: broadcast.title,
        summary: this.buildSafeSummary(broadcast.type as BroadcastType, broadcast.title, broadcast.body, metadata),
        authorLabel,
        adminVerified: broadcast.adminVerified,
        country: broadcast.country,
        state: broadcast.state,
        approximateArea: this.approximateArea(metadata, broadcast.state, broadcast.country),
        publishedAt: broadcast.publishedAt,
        updatedAt: broadcast.createdAt,
        expiresAt: broadcast.expiresAt,
        statusBanner: this.statusBanner(String(broadcast.status)),
        shareUrl: `/share/broadcasts/${broadcast.id}`,
        deepLink: `/broadcasts/${broadcast.id}`,
        openGraph: {
          title: broadcast.title,
          description: this.buildSafeSummary(broadcast.type as BroadcastType, broadcast.title, broadcast.body, metadata),
          status: broadcast.status,
        },
      },
    };
  }

  private buildSafeSummary(
    type: BroadcastType,
    title: string,
    body: string,
    metadata: Record<string, unknown>,
  ) {
    if (type === BroadcastType.MissingPerson) {
      const name = typeof metadata.fullName === "string" ? metadata.fullName : title;
      const age = typeof metadata.ageOrApproximateAge === "string" ? metadata.ageOrApproximateAge : "unknown age";
      return `Missing person alert: ${name}, approx. age ${age}.`;
    }
    if (type === BroadcastType.StolenVehicle) {
      const make = typeof metadata.make === "string" ? metadata.make : "";
      const model = typeof metadata.model === "string" ? metadata.model : "";
      const reg =
        typeof metadata.registrationMasked === "string"
          ? metadata.registrationMasked
          : typeof metadata.registrationNumber === "string"
            ? maskRegistrationNumber(metadata.registrationNumber)
            : "";
      return `Stolen vehicle alert: ${make} ${model} ${reg}`.trim();
    }
    return body.slice(0, 280);
  }

  private approximateArea(metadata: Record<string, unknown>, state?: string | null, country?: string | null) {
    if (typeof metadata.lastSeenAddress === "string" && metadata.lastSeenAddress.trim()) {
      return metadata.lastSeenAddress.trim();
    }
    if (typeof metadata.lastKnownLocation === "string" && metadata.lastKnownLocation.trim()) {
      return metadata.lastKnownLocation.trim();
    }
    return [state, country].filter(Boolean).join(", ") || null;
  }

  private statusBanner(status: string) {
    if (status === BroadcastStatus.Resolved) return "Resolved";
    if (status === BroadcastStatus.Suspended) return "Suspended";
    if (status === BroadcastStatus.WithdrawnByAuthor) return "Withdrawn";
    if (status === BroadcastStatus.Expired) return "Expired";
    return "Active";
  }
}
