import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SmtpEmailProvider } from "../../../common/delivery/smtp-email.provider";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationDispatchError } from "../notification-dispatch.error";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "../notification.types";

@Injectable()
export class EmailProvider {
  private readonly smtp: SmtpEmailProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.smtp = new SmtpEmailProvider(config);
  }

  private async sendViaSmtp(email: string, payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const result = await this.smtp.send({
      to: email,
      subject: payload.title ?? "THE EYE notification",
      text: payload.body ?? "",
    });
    if (result.status === "ProviderAccepted") {
      return {
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        status: "Sent",
      };
    }
    throw new NotificationDispatchError("SMTP email delivery failed", "smtp", result.retryable, { email });
  }

  async send(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const email = await this.resolveEmail(payload);
    if (!email) {
      throw new NotificationDispatchError("Email delivery requires an email address", "email", false);
    }

    const provider = this.config.get<string>("EMAIL_PROVIDER") ?? "disabled";
    const disabled = this.config.get<string>("EMAIL_PROVIDER_DISABLED", "true") !== "false";

    if (provider === "smtp" || this.smtp.isConfigured()) {
      return this.sendViaSmtp(email, payload);
    }

    if (disabled) {
      throw new NotificationDispatchError(
        "Email provider is disabled. Configure EMAIL_PROVIDER=smtp with SMTP_* credentials.",
        "email-disabled",
        false,
        { placeholder: true },
      );
    }

    throw new NotificationDispatchError(
      "Email provider is enabled but no supported integration is configured",
      "email",
      false,
      { email },
    );
  }

  private async resolveEmail(payload: NotificationDispatchPayload) {
    if (payload.email?.trim()) return payload.email.trim();
    if (payload.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
      if (user?.email) return user.email;
    }
    if (payload.adminUserId) {
      const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.adminUserId }, select: { email: true } });
      if (admin?.email) return admin.email;
    }
    return undefined;
  }
}
