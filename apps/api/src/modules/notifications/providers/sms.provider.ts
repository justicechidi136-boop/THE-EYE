import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationDispatchError } from "../notification-dispatch.error";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "../notification.types";

@Injectable()
export class SmsProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async send(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const disabled = this.config.get<string>("SMS_PROVIDER_DISABLED", "true") !== "false";
    const phone = await this.resolvePhone(payload);

    if (!phone) {
      throw new NotificationDispatchError("SMS delivery requires a phone number", "sms-placeholder", false);
    }

    if (disabled) {
      throw new NotificationDispatchError(
        "SMS provider is disabled. Configure SMS_PROVIDER_DISABLED=false and a real SMS integration.",
        "sms-placeholder",
        false,
        { placeholder: true, phone },
      );
    }

    throw new NotificationDispatchError(
      "SMS provider is enabled but no production SMS integration is configured",
      "sms-placeholder",
      false,
      { phone },
    );
  }

  private async resolvePhone(payload: NotificationDispatchPayload) {
    if (payload.phone?.trim()) return payload.phone.trim();

    if (payload.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: payload.userId }, select: { phone: true } });
      if (user?.phone) return user.phone;
    }

    return undefined;
  }
}
