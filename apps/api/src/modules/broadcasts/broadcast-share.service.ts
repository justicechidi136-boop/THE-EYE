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

export function resolvePublicBroadcastShareBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
) {
  const configured = env.PUBLIC_BROADCAST_SHARE_BASE_URL?.trim();
  if (configured) {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" && env.NODE_ENV !== "development") {
      throw new Error("PUBLIC_BROADCAST_SHARE_BASE_URL must use HTTPS");
    }
    return configured.replace(/\/$/, "");
  }
  const appEnv = String(env.THE_EYE_APP_ENV ?? env.NODE_ENV ?? "development")
    .trim()
    .toLowerCase();
  if (appEnv === "staging") {
    return "https://staging-dashboard8jps.theeye.com.ng";
  }
  if (appEnv === "production") return "https://dashboard.theeye.com.ng";
  return "http://localhost:3000";
}

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
    const approximateArea = this.approximateArea(
      metadata,
      broadcast.state,
      broadcast.country,
    );
    const shareUrl = `${resolvePublicBroadcastShareBaseUrl()}/share/broadcasts/${broadcast.id}`;
    const summary = this.buildSafeSummary(
      broadcast.type as BroadcastType,
      broadcast.title,
      broadcast.body,
      metadata,
    );

    return {
      data: {
        id: broadcast.id,
        type: broadcast.type,
        status: broadcast.status,
        title: broadcast.title,
        summary,
        authorLabel,
        adminVerified: broadcast.adminVerified,
        country: broadcast.country,
        state: broadcast.state,
        approximateArea,
        publishedAt: broadcast.publishedAt,
        updatedAt: broadcast.createdAt,
        expiresAt: broadcast.expiresAt,
        statusBanner: this.statusBanner(String(broadcast.status)),
        shareUrl,
        deepLink: shareUrl,
        shareText: this.buildShareText({
          type: broadcast.type as BroadcastType,
          subject: this.shareSubject(
            broadcast.type as BroadcastType,
            broadcast.title,
            metadata,
          ),
          summary,
          approximateArea,
          lastSeenAt: metadata.lastSeenAt,
          shareUrl,
        }),
        openGraph: {
          title: broadcast.title,
          description: this.buildSafeSummary(broadcast.type as BroadcastType, broadcast.title, broadcast.body, metadata),
          status: broadcast.status,
        },
      },
    };
  }

  private buildShareText(input: {
    type: BroadcastType;
    subject: string;
    summary: string;
    approximateArea: string | null;
    lastSeenAt: unknown;
    shareUrl: string;
  }) {
    const heading = input.type === BroadcastType.StolenVehicle
      ? "🚨 Stolen Vehicle Alert"
      : input.type === BroadcastType.MissingPerson
        ? "🚨 Missing Person Alert"
        : "🚨 Safety Broadcast";
    const parsedLastSeen = typeof input.lastSeenAt === "string"
      ? new Date(input.lastSeenAt)
      : null;
    const subjectLabel = input.type === BroadcastType.StolenVehicle
      ? "Stolen vehicle"
      : input.type === BroadcastType.MissingPerson
        ? "Missing person"
        : "Broadcast";
    return [
      heading,
      `${subjectLabel}: ${input.subject}`,
      input.type !== BroadcastType.StolenVehicle &&
      input.type !== BroadcastType.MissingPerson &&
      input.summary !== input.subject
        ? input.summary
        : null,
      input.approximateArea
        ? `Last known location: ${input.approximateArea}`
        : null,
      parsedLastSeen && !Number.isNaN(parsedLastSeen.getTime())
        ? `Last seen: ${parsedLastSeen.toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}`
        : null,
      `View full broadcast: ${input.shareUrl}`,
    ].filter(Boolean).join("\n");
  }

  private shareSubject(
    type: BroadcastType,
    title: string,
    metadata: Record<string, unknown>,
  ) {
    if (type === BroadcastType.MissingPerson) {
      const name = typeof metadata.fullName === "string"
        ? metadata.fullName.trim()
        : "";
      return name || title.replace(/^Missing person:\s*/i, "").trim();
    }
    if (type === BroadcastType.StolenVehicle) {
      const make = typeof metadata.make === "string" ? metadata.make.trim() : "";
      const model = typeof metadata.model === "string" ? metadata.model.trim() : "";
      const registration = typeof metadata.registrationMasked === "string"
        ? metadata.registrationMasked.trim()
        : typeof metadata.registrationNumber === "string"
          ? maskRegistrationNumber(metadata.registrationNumber)
          : "";
      const vehicle = [make, model].filter(Boolean).join(" ");
      if (vehicle) return registration ? `${vehicle} (${registration})` : vehicle;
      return title.replace(/^Stolen vehicle:\s*/i, "").trim();
    }
    return title.trim();
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
