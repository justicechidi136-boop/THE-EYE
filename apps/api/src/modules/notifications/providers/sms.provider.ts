import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TermiiSmsProvider } from "../../../common/delivery/termii-sms.provider";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationDispatchError } from "../notification-dispatch.error";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "../notification.types";

@Injectable()
export class SmsProvider {
  private readonly termii: TermiiSmsProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.termii = new TermiiSmsProvider(config);
  }

  private async sendViaTermii(phone: string, text: string): Promise<NotificationDispatchResult> {
    const result = await this.termii.send({ to: phone, text });
    if (result.status === "ProviderAccepted") {
      return {
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        status: "Sent",
      };
    }
    throw new NotificationDispatchError("Termii SMS delivery failed", "termii", result.retryable, { phone });
  }

  async send(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const phone = await this.resolvePhone(payload);
    if (!phone) {
      throw new NotificationDispatchError("SMS delivery requires a phone number", "sms", false);
    }

    const text = payload.body ?? payload.title ?? "THE EYE alert";
    const provider = this.config.get<string>("SMS_PROVIDER") ?? "disabled";
    const disabled = this.config.get<string>("SMS_PROVIDER_DISABLED", "true") !== "false";

    if (provider === "termii" || this.termii.isConfigured()) {
      return this.sendViaTermii(phone, text);
    }

    if (disabled) {
      throw new NotificationDispatchError(
        "SMS provider is disabled. Configure SMS_PROVIDER=termii with TERMII_* credentials.",
        "sms-disabled",
        false,
        { placeholder: true },
      );
    }

    throw new NotificationDispatchError(
      "SMS provider is enabled but no supported integration is configured",
      "sms",
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
