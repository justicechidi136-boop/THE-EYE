import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SmtpEmailProvider } from "../../common/delivery/smtp-email.provider";
import { TermiiSmsProvider } from "../../common/delivery/termii-sms.provider";
import { maskEmail, maskPhone } from "../../common/delivery/safe-delivery-log";

type AuthDeliveryPayload =
  | {
      type: "password_reset";
      email: string;
      token: string;
    }
  | {
      type: "account_recovery";
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
  private readonly smtp: SmtpEmailProvider;
  private readonly termii: TermiiSmsProvider;

  constructor(private readonly config: ConfigService) {
    this.smtp = new SmtpEmailProvider(config);
    this.termii = new TermiiSmsProvider(config);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    if (this.smtp.isConfigured()) {
      const resetBase = this.config.get<string>("PASSWORD_RESET_LINK_BASE_URL")?.trim()
        ?? this.config.get<string>("MOBILE_PASSWORD_RESET_URL")?.trim();
      const resetLink = resetBase
        ? `${resetBase}${resetBase.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
        : null;
      const result = await this.smtp.send({
        to: email,
        subject: "Reset your THE EYE password",
        text: resetLink
          ? `Use this link to reset your password (valid for 30 minutes): ${resetLink}`
          : "Use the password reset code in THE EYE to complete your request.",
        html: resetLink
          ? `<p>Use this link to reset your password (valid for 30 minutes):</p><p><a href="${resetLink}">Reset password</a></p>`
          : "<p>Use the password reset code in THE EYE to complete your request.</p>",
      });
      if (result.status === "ProviderAccepted") {
        this.logger.log(`Password reset email accepted by SMTP for ${maskEmail(email)}`);
        return;
      }
      throw new ServiceUnavailableException({
        message: "Password reset email could not be sent. Try again shortly.",
        code: "AUTH_DELIVERY_FAILED",
      });
    }

    await this.dispatchWebhook(
      this.config.get<string>("AUTH_PASSWORD_RESET_WEBHOOK_URL"),
      { type: "password_reset", email, token },
      "password reset email",
    );
  }

  async sendAccountRecoveryEmail(email: string, token: string, expiresAt: Date): Promise<void> {
    const recoveryBase = this.config.get<string>("ACCOUNT_RECOVERY_LINK_BASE_URL")?.trim()
      ?? this.config.get<string>("MOBILE_ACCOUNT_RECOVERY_URL")?.trim()
      ?? this.config.get<string>("MOBILE_PASSWORD_RESET_URL")?.trim();
    const recoveryLink = recoveryBase
      ? `${recoveryBase}${recoveryBase.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
      : null;
    const expiryText = expiresAt.toISOString();
    const fromName = this.config.get<string>("SMTP_FROM_NAME") ?? "THE EYE";

    if (this.smtp.isConfigured()) {
      const result = await this.smtp.send({
        to: email,
        subject: "Recover your THE EYE account",
        text: recoveryLink
          ? `A recovery request was made for your THE EYE account. Use this secure link before ${expiryText}: ${recoveryLink}\n\nIf you did not request this, secure your account immediately.`
          : "A recovery request was made for your THE EYE account. Open THE EYE to continue recovery.",
        html: recoveryLink
          ? `<p>A recovery request was made for your ${fromName} account.</p><p><a href="${recoveryLink}">Recover account</a></p><p>This link expires at ${expiryText}.</p><p>If you did not request this, secure your account immediately.</p>`
          : `<p>A recovery request was made for your ${fromName} account. Open THE EYE to continue recovery.</p>`,
      });
      if (result.status === "ProviderAccepted") {
        this.logger.log(`Account recovery email accepted by SMTP for ${maskEmail(email)}`);
        return;
      }
      throw new ServiceUnavailableException({
        message: "Account recovery email could not be sent. Try again shortly.",
        code: "AUTH_DELIVERY_FAILED",
      });
    }

    await this.dispatchWebhook(
      this.config.get<string>("AUTH_ACCOUNT_RECOVERY_WEBHOOK_URL"),
      { type: "account_recovery", email, token },
      "account recovery email",
    );
  }

  async sendPhoneOtp(phone: string, code: string, purpose: string): Promise<void> {
    if (this.termii.isConfigured()) {
      const result = await this.termii.send({
        to: phone,
        text: `Your THE EYE verification code is ${code}. It expires in 10 minutes.`,
        purpose,
      });
      if (result.status === "ProviderAccepted") {
        this.logger.log(`Phone OTP accepted by Termii for ${maskPhone(phone)} purpose=${purpose}`);
        return;
      }
      throw new ServiceUnavailableException({
        message: "Verification SMS could not be sent. Try again shortly.",
        code: "AUTH_DELIVERY_FAILED",
      });
    }

    await this.dispatchWebhook(
      this.config.get<string>("AUTH_PHONE_OTP_WEBHOOK_URL"),
      { type: "phone_otp", phone, code, purpose },
      "phone OTP",
    );
  }

  allowDevAuthCodes(): boolean {
    return (
      process.env.NODE_ENV === "development" &&
      this.config.get<string>("ALLOW_DEV_AUTH_CODES") === "true"
    );
  }

  private async dispatchWebhook(
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
        `${channelLabel} delivery skipped in development; configure SMTP/Termii or AUTH_* webhook.`,
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
