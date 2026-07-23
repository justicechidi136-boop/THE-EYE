import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { ProviderDeliveryResult, SmsMessage } from "./delivery.types";
import { maskPhone } from "./safe-delivery-log";

export class TermiiSmsProvider {
  private readonly logger = new Logger(TermiiSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      this.config.get<string>("SMS_PROVIDER") === "termii" &&
      Boolean(this.config.get<string>("TERMII_API_KEY")?.trim()) &&
      Boolean(this.config.get<string>("TERMII_SENDER_ID")?.trim())
    );
  }

  async send(message: SmsMessage): Promise<ProviderDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        provider: "termii",
        status: "Failed",
        retryable: false,
        metadata: { reason: "termii_not_configured" },
      };
    }

    const baseUrl = (this.config.get<string>("TERMII_BASE_URL") ?? "https://api.ng.termii.com").replace(/\/$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${baseUrl}/api/sms/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          api_key: this.config.get<string>("TERMII_API_KEY"),
          to: message.to,
          from: this.config.get<string>("TERMII_SENDER_ID"),
          sms: message.text,
          type: "plain",
          channel: "generic",
        }),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        this.logger.error(`Termii send failed (${response.status}) for ${maskPhone(message.to)}`);
        return {
          provider: "termii",
          status: "Failed",
          retryable: response.status >= 500,
          metadata: { reason: "termii_api_error", status: response.status },
        };
      }

      this.logger.log(`Termii accepted SMS for ${maskPhone(message.to)}`);
      return {
        provider: "termii",
        providerMessageId: String(body.message_id ?? body.messageId ?? ""),
        status: "ProviderAccepted",
        retryable: false,
      };
    } catch (error) {
      this.logger.error(`Termii send error for ${maskPhone(message.to)}`, error as Error);
      return {
        provider: "termii",
        status: "Failed",
        retryable: true,
        metadata: { reason: "termii_request_failed" },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
