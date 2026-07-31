import { ForbiddenException, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { adminCanAccessGeography, adminGeographyWhere } from "../../common/auth/admin-geography-scope";
import { PrismaService } from "../prisma/prisma.service";
import type { WatchAlertTelemetryInput } from "./watch-danger-alert.types";

export type WatchAlertTelemetryFilters = {
  from?: Date;
  to?: Date;
  alertCode?: string;
  language?: string;
  country?: string;
  state?: string;
  lga?: string;
  channel?: string;
  deliveryStatus?: string;
  acknowledged?: boolean;
  severity?: string;
};

function maskDeviceId(deviceId?: string | null) {
  if (!deviceId) return null;
  if (deviceId.length <= 8) return "***";
  return `${deviceId.slice(0, 4)}…${deviceId.slice(-4)}`;
}

function maskUserId(userId?: string | null) {
  if (!userId) return null;
  if (userId.length <= 8) return "***";
  return `${userId.slice(0, 4)}…${userId.slice(-4)}`;
}

@Injectable()
export class WatchAlertTelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: WatchAlertTelemetryInput) {
    const delivery = await (this.prisma as any).safetyAlertDelivery.findFirst({
      where: {
        safetyAlertId: input.safetyAlertId,
        ...(input.deviceId ? { recipient: { deviceId: input.deviceId } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const metadata = {
      ...(delivery?.metadata ?? {}),
      telemetry: [
        ...(((delivery?.metadata as any)?.telemetry ?? []) as unknown[]),
        {
          event: input.event,
          at: new Date().toISOString(),
          channel: input.channel,
          language: input.language,
          reason: input.reason,
          ...(input.metadata ?? {}),
        },
      ].slice(-50),
    };

    if (delivery) {
      await (this.prisma as any).safetyAlertDelivery.update({
        where: { id: delivery.id },
        data: { metadata },
      });
    }

    return { recorded: true, deliveryId: delivery?.id ?? null };
  }

  private buildGeographyWhere(actor: JwtPayload, filters?: WatchAlertTelemetryFilters) {
    const scope = adminGeographyWhere(actor);
    const geography = {
      country: filters?.country ?? scope?.country,
      state: filters?.state ?? scope?.state,
      lga: filters?.lga ?? scope?.lga,
    };

    return {
      ...(geography.country ? { country: geography.country } : {}),
      ...(geography.state ? { state: geography.state } : {}),
      ...(geography.lga ? { lga: geography.lga } : {}),
    };
  }

  async summary(actor: JwtPayload, filters?: WatchAlertTelemetryFilters) {
    const geographyWhere = this.buildGeographyWhere(actor, filters);
    const deliveries = await (this.prisma as any).safetyAlertDelivery.findMany({
      where: {
        channel: filters?.channel
          ? filters.channel
          : { in: ["watch_push", "phone_relay", "push"] },
        ...(filters?.deliveryStatus ? { status: filters.deliveryStatus } : {}),
        ...(filters?.from || filters?.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
        safetyAlert: {
          ...(filters?.alertCode
            ? {
                metadata: {
                  path: ["dangerAlertCode"],
                  equals: filters.alertCode,
                },
              }
            : {}),
          dangerZone: Object.keys(geographyWhere).length ? geographyWhere : undefined,
        },
      },
      include: {
        safetyAlert: {
          include: {
            dangerZone: {
              select: {
                country: true,
                state: true,
                lga: true,
                incidentId: true,
                metadata: true,
              },
            },
            acknowledgements: true,
          },
        },
        recipient: {
          include: {
            device: {
              select: {
                model: true,
                firmwareVersion: true,
                batteryLevel: true,
                connectivityMode: true,
                metadata: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const scopedDeliveries = deliveries.filter((delivery: any) => {
      const zone = delivery.safetyAlert?.dangerZone;
      if (!zone) return actor.role === "SuperAdmin";
      return adminCanAccessGeography(zone, actor);
    });

    const events = scopedDeliveries.flatMap((delivery: any) => {
      const alertLanguage =
        (delivery.safetyAlert?.metadata as any)?.languageHint ??
        (delivery.recipient?.device?.metadata as any)?.accessibilityPreferences?.preferredSpokenLanguage;
      const acknowledged = (delivery.safetyAlert?.acknowledgements?.length ?? 0) > 0;

      if (filters?.language && alertLanguage !== filters.language) return [];
      if (filters?.acknowledged !== undefined && acknowledged !== filters.acknowledged) return [];

      return ((delivery.metadata?.telemetry ?? []) as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        safetyAlertId: delivery.safetyAlertId,
        channel: delivery.channel,
        status: delivery.status,
        userId: maskUserId(delivery.recipient?.userId),
        deviceId: maskDeviceId(delivery.recipient?.deviceId),
        language: entry.language ?? alertLanguage,
        country: delivery.safetyAlert?.dangerZone?.country,
        state: delivery.safetyAlert?.dangerZone?.state,
        lga: delivery.safetyAlert?.dangerZone?.lga,
        batteryLevel: delivery.recipient?.device?.batteryLevel,
        model: delivery.recipient?.device?.model,
        firmwareVersion: delivery.recipient?.device?.firmwareVersion,
        connectivityMode: delivery.recipient?.device?.connectivityMode,
        acknowledged,
        alertCode: (delivery.safetyAlert?.metadata as any)?.dangerAlertCode,
      }));
    });

    const counts: Record<string, number> = {};
    for (const entry of events) {
      const key = String((entry as { event?: string }).event ?? "unknown");
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return {
      scope: adminGeographyWhere(actor),
      totals: {
        deliveries: scopedDeliveries.length,
        acknowledged: scopedDeliveries.filter(
          (d: any) => (d.safetyAlert?.acknowledgements?.length ?? 0) > 0,
        ).length,
        targetUsers: new Set(
          scopedDeliveries.map((d: any) => d.recipient?.userId).filter(Boolean),
        ).size,
        ...counts,
      },
      events: events.slice(0, 200),
    };
  }

  async alertDetail(actor: JwtPayload, safetyAlertId: string) {
    const deliveries = await (this.prisma as any).safetyAlertDelivery.findMany({
      where: { safetyAlertId },
      include: {
        safetyAlert: {
          include: {
            dangerZone: true,
            acknowledgements: true,
          },
        },
        recipient: {
          include: {
            device: {
              select: {
                model: true,
                connectivityMode: true,
                metadata: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!deliveries.length) {
      throw new ForbiddenException("Alert telemetry not found");
    }

    const zone = deliveries[0]?.safetyAlert?.dangerZone;
    if (zone && !adminCanAccessGeography(zone, actor)) {
      throw new ForbiddenException("Alert is outside your geography scope");
    }

    const channels = deliveries.map((delivery: any) => ({
      channel: delivery.channel,
      status: delivery.status,
      deviceId: maskDeviceId(delivery.recipient?.deviceId),
      connectivityMode: delivery.recipient?.device?.connectivityMode,
      telemetry: ((delivery.metadata?.telemetry ?? []) as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        deviceId: maskDeviceId(delivery.recipient?.deviceId),
      })),
      retryCount: delivery.attemptCount ?? 0,
      failureReason: delivery.failureReason ?? null,
    }));

    const dedupeEvents = channels.flatMap((channel) =>
      channel.telemetry.filter((entry) => entry.event === "duplicate_suppressed"),
    );
    const fallbackEvents = channels.flatMap((channel) =>
      channel.telemetry.filter((entry) => entry.event === "fallback_language"),
    );

    return {
      safetyAlertId,
      incidentRef: zone?.incidentId ? maskUserId(zone.incidentId) : null,
      alertCode: (deliveries[0]?.safetyAlert?.metadata as any)?.dangerAlertCode ?? null,
      issuedAt: deliveries[0]?.createdAt ?? null,
      expiresAt: (deliveries[0]?.safetyAlert?.metadata as any)?.expiresAt ?? null,
      recipientCount: deliveries.length,
      acknowledgementCount: deliveries[0]?.safetyAlert?.acknowledgements?.length ?? 0,
      geography: zone
        ? { country: zone.country, state: zone.state, lga: zone.lga }
        : null,
      channels,
      dedupeSummary: {
        suppressed: dedupeEvents.length,
        reasons: dedupeEvents.map((entry) => entry.reason).filter(Boolean),
      },
      fallbackSummary: {
        count: fallbackEvents.length,
        languages: fallbackEvents.map((entry) => entry.language).filter(Boolean),
      },
    };
  }
}
