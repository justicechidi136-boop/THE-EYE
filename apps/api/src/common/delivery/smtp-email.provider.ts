import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { EmailMessage, ProviderDeliveryResult } from "./delivery.types";
import { maskEmail } from "./safe-delivery-log";

export class SmtpEmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      this.config.get<string>("EMAIL_PROVIDER") === "smtp" &&
      Boolean(this.config.get<string>("SMTP_HOST")?.trim()) &&
      Boolean(this.config.get<string>("SMTP_USERNAME")?.trim()) &&
      Boolean(this.config.get<string>("SMTP_PASSWORD")?.trim()) &&
      Boolean(this.config.get<string>("SMTP_FROM_EMAIL")?.trim())
    );
  }

  async send(message: EmailMessage): Promise<ProviderDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        provider: "smtp",
        status: "Failed",
        retryable: false,
        metadata: { reason: "smtp_not_configured" },
      };
    }

    const transporter = nodemailer.createTransport({
      host: this.config.get<string>("SMTP_HOST"),
      port: Number(this.config.get<string>("SMTP_PORT") ?? 587),
      secure: this.config.get<string>("SMTP_SECURE") === "true",
      auth: {
        user: this.config.get<string>("SMTP_USERNAME"),
        pass: this.config.get<string>("SMTP_PASSWORD"),
      },
    });

    try {
      const info = await transporter.sendMail({
        from: {
          name: this.config.get<string>("SMTP_FROM_NAME") ?? "THE EYE",
          address: this.config.get<string>("SMTP_FROM_EMAIL")!,
        },
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html ?? message.text,
      });

      this.logger.log(`SMTP accepted message for ${maskEmail(message.to)}`);
      return {
        provider: "smtp",
        providerMessageId: info.messageId,
        status: "ProviderAccepted",
        retryable: false,
      };
    } catch (error) {
      this.logger.error(`SMTP send failed for ${maskEmail(message.to)}`, error as Error);
      return {
        provider: "smtp",
        status: "Failed",
        retryable: true,
        metadata: { reason: "smtp_send_failed" },
      };
    }
  }
}
