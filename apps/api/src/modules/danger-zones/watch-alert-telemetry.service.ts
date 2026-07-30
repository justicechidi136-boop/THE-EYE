import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { WatchAlertTelemetryInput } from "./watch-danger-alert.types";

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

  async summary(filters?: {
    from?: Date;
    to?: Date;
    alertCode?: string;
    language?: string;
  }) {
    const deliveries = await (this.prisma as any).safetyAlertDelivery.findMany({
      where: {
        channel: { in: ["watch_push", "phone_relay", "push"] },
        ...(filters?.from || filters?.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: {
        safetyAlert: {
          include: {
            dangerZone: { select: { country: true, state: true, lga: true, incidentId: true } },
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
                metadata: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const events = deliveries.flatMap((delivery: any) => {
      const telemetry = ((delivery.metadata?.telemetry ?? []) as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        safetyAlertId: delivery.safetyAlertId,
        channel: delivery.channel,
        status: delivery.status,
        userId: delivery.recipient?.userId,
        deviceId: delivery.recipient?.deviceId,
        language: (delivery.recipient?.device?.metadata as any)?.accessibilityPreferences?.preferredSpokenLanguage,
        country: delivery.safetyAlert?.dangerZone?.country,
        state: delivery.safetyAlert?.dangerZone?.state,
        lga: delivery.safetyAlert?.dangerZone?.lga,
        batteryLevel: delivery.recipient?.device?.batteryLevel,
        model: delivery.recipient?.device?.model,
        firmwareVersion: delivery.recipient?.device?.firmwareVersion,
        acknowledged: (delivery.safetyAlert?.acknowledgements?.length ?? 0) > 0,
      }));
      return telemetry;
    });

    const counts = events.reduce<Record<string, number>>((acc, entry) => {
      const key = String(entry.event ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totals: {
        deliveries: deliveries.length,
        acknowledged: deliveries.filter((d: any) => (d.safetyAlert?.acknowledgements?.length ?? 0) > 0).length,
        ...counts,
      },
      events: events.slice(0, 200),
    };
  }
}
