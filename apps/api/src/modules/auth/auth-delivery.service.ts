import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type AuthDeliveryPayload =
  | {
      type: "password_reset";
      email: string;
      token: string;
    }
  | {
      type: "phone_otp";
      phone: string;
      code: string;
      purpose: string;
    };

@Injectable()
export class AuthDeliveryService {
  private readonly logger = new Logger(AuthDeliveryService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    await this.dispatch(
      this.config.get<string>("AUTH_PASSWORD_RESET_WEBHOOK_URL"),
      {
        type: "password_reset",
        email,
        token,
      },
      "password reset email",
    );
  }

  async sendPhoneOtp(phone: string, code: string, purpose: string): Promise<void> {
    await this.dispatch(
      this.config.get<string>("AUTH_PHONE_OTP_WEBHOOK_URL"),
      {
        type: "phone_otp",
        phone,
        code,
        purpose,
      },
      "phone OTP",
    );
  }

  allowDevAuthCodes(): boolean {
    return (
      process.env.NODE_ENV === "development" &&
      this.config.get<string>("ALLOW_DEV_AUTH_CODES") === "true"
    );
  }

  private async dispatch(
    webhookUrl: string | undefined,
    payload: AuthDeliveryPayload,
    channelLabel: string,
  ): Promise<void> {
    if (webhookUrl?.trim()) {
      this.assertSecureWebhookUrl(webhookUrl.trim());
      await this.postWebhook(webhookUrl.trim(), payload);
      return;
    }

    if (this.allowDevAuthCodes()) {
      this.logger.warn(
        `${channelLabel} delivery skipped in development; configure AUTH_* webhook or disable ALLOW_DEV_AUTH_CODES for production-like behavior.`,
      );
      return;
    }

    throw new ServiceUnavailableException({
      message: `${channelLabel} delivery is not configured.`,
      code: "AUTH_DELIVERY_UNAVAILABLE",
    });
  }

  private assertSecureWebhookUrl(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ServiceUnavailableException({
        message: "Auth delivery webhook URL is invalid.",
        code: "AUTH_DELIVERY_INSECURE_URL",
      });
    }

    const appEnv = this.config.get<string>("THE_EYE_APP_ENV") ?? process.env.NODE_ENV ?? "development";
    const requiresHttps = appEnv === "staging" || appEnv === "production" || process.env.NODE_ENV === "staging" || process.env.NODE_ENV === "production";
    if (requiresHttps && parsed.protocol !== "https:") {
      throw new ServiceUnavailableException({
        message: "Auth delivery webhook must use HTTPS in staging and production.",
        code: "AUTH_DELIVERY_INSECURE_URL",
      });
    }
  }

  private buildWebhookHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    const secret = this.config.get<string>("AUTH_DELIVERY_WEBHOOK_SECRET");
    if (secret?.trim()) {
      headers["x-the-eye-delivery-secret"] = secret.trim();
    }
    return headers;
  }

  private async postWebhook(url: string, payload: AuthDeliveryPayload): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildWebhookHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        this.logger.error(
          `Auth delivery webhook failed (${response.status}) for ${payload.type}: ${body.slice(0, 240)}`,
        );
        throw new ServiceUnavailableException({
          message: "Authentication delivery failed. Try again shortly.",
          code: "AUTH_DELIVERY_FAILED",
        });
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`Auth delivery webhook error for ${payload.type}`, error as Error);
      throw new ServiceUnavailableException({
        message: "Authentication delivery failed. Try again shortly.",
        code: "AUTH_DELIVERY_FAILED",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
