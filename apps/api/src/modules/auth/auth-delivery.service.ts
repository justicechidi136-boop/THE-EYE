import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { formatCitizenEmailTimestamp } from "@the-eye/shared";
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
      if (!resetBase) {
        throw new ServiceUnavailableException({
          message: "Password reset email is not configured for this environment.",
          code: "AUTH_PASSWORD_RESET_LINK_BASE_MISSING",
        });
      }
      this.assertHttpsRecoveryBase(resetBase, "PASSWORD_RESET_LINK_BASE_URL");
      const resetLink = `${resetBase}${resetBase.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
      const result = await this.smtp.send({
        to: email,
        subject: "Reset your THE EYE password",
        text: `Use this link to reset your password (valid for 30 minutes): ${resetLink}`,
        html: `<p>Use this link to reset your password (valid for 30 minutes):</p><p><a href="${resetLink}">Reset password</a></p>`,
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
      ?? this.config.get<string>("AUTH_RECOVERY_DEEP_LINK_BASE")?.trim();
    const expiryText = formatCitizenEmailTimestamp(expiresAt);
    const requestedAt = formatCitizenEmailTimestamp(new Date());
    const fromName = this.config.get<string>("SMTP_FROM_NAME") ?? "THE EYE";

    if (this.smtp.isConfigured()) {
      if (!recoveryBase) {
        throw new ServiceUnavailableException({
          message: "Account recovery email is not configured for this environment.",
          code: "AUTH_RECOVERY_LINK_BASE_MISSING",
        });
      }
      this.assertHttpsRecoveryBase(recoveryBase, "ACCOUNT_RECOVERY_LINK_BASE_URL");
      const recoveryLink = `${recoveryBase}${recoveryBase.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
      const result = await this.smtp.send({
        to: email,
        subject: "Recover your THE EYE account",
        text: [
          `A recovery request was made for your ${fromName} account at ${requestedAt}.`,
          `Use this secure link before ${expiryText}:`,
          recoveryLink,
          "",
          "If you did not request this, secure your account immediately.",
        ].join("\n"),
        html: [
          `<p>A recovery request was made for your ${fromName} account at ${requestedAt}.</p>`,
          `<p><a href="${recoveryLink}" style="display:inline-block;padding:12px 18px;background:#FF9933;color:#0B0F14;text-decoration:none;border-radius:8px;font-weight:700;">Recover account</a></p>`,
          `<p>Or copy this link: <a href="${recoveryLink}">${recoveryLink}</a></p>`,
          `<p>This link expires at ${expiryText} and can be used once.</p>`,
          `<p>If you did not request this, secure your account immediately.</p>`,
        ].join(""),
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

  private assertHttpsRecoveryBase(baseUrl: string, envKey: string) {
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new ServiceUnavailableException({
        message: `${envKey} must be a valid HTTPS URL.`,
        code: "AUTH_RECOVERY_LINK_BASE_INVALID",
      });
    }
    if (parsed.protocol !== "https:") {
      throw new ServiceUnavailableException({
        message: `${envKey} must use HTTPS.`,
        code: "AUTH_RECOVERY_LINK_BASE_INSECURE",
      });
    }
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
