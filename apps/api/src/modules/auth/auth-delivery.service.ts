import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { formatCitizenEmailTimestamp } from "@the-eye/shared";
import { SmtpEmailProvider } from "../../common/delivery/smtp-email.provider";
import { TermiiSmsProvider } from "../../common/delivery/termii-sms.provider";
import { maskEmail, maskPhone } from "../../common/delivery/safe-delivery-log";
import {
  AuthRecoveryUrlError,
  authLinkHostname,
  buildAuthActionLink,
  resolveAccountRecoveryBaseUrl,
  resolveAdminInvitationBaseUrl,
  resolvePasswordResetBaseUrl,
} from "./auth-recovery-urls";

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
      type: "admin_invitation";
      email: string;
      token: string;
      expiresAt: string;
    }
  | {
      type: "phone_otp";
      phone: string;
      code: string;
      purpose: string;
    };

type AdminInvitationContext = {
  displayName: string;
  role: string;
  organisation: string;
  scope: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
      const resetBase = resolvePasswordResetBaseUrl({
        PASSWORD_RESET_LINK_BASE_URL: this.config.get<string>("PASSWORD_RESET_LINK_BASE_URL"),
        MOBILE_PASSWORD_RESET_URL: this.config.get<string>("MOBILE_PASSWORD_RESET_URL"),
      });
      if (!resetBase) {
        throw new ServiceUnavailableException({
          message: "Password reset email is not configured for this environment.",
          code: "AUTH_PASSWORD_RESET_LINK_BASE_MISSING",
        });
      }
      let resetLink: string;
      try {
        resetLink = buildAuthActionLink(resetBase, token, "password_reset", process.env);
      } catch (error) {
        throw this.toDeliveryConfigException(error);
      }
      const host = authLinkHostname(resetBase);
      const result = await this.smtp.send({
        to: email,
        subject: "Reset your THE EYE password",
        text: [
          "THE EYE password reset",
          "",
          "We received a request to reset your password.",
          "Open the secure link below. It expires in 30 minutes and can be used once.",
          resetLink,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: [
          `<p><strong>THE EYE</strong></p>`,
          `<p>We received a request to reset your password.</p>`,
          `<p><a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#FF9933;color:#0B0F14;text-decoration:none;border-radius:8px;font-weight:700;">Reset password</a></p>`,
          `<p>Or copy this link:<br/><a href="${resetLink}">${resetLink}</a></p>`,
          `<p>This link expires in 30 minutes and can be used once.</p>`,
          `<p>If you did not request this, you can ignore this email.</p>`,
        ].join(""),
      });
      if (result.status === "ProviderAccepted") {
        this.logger.log(
          `Password reset email accepted by SMTP for ${maskEmail(email)} host=${host ?? "unknown"}`,
        );
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
    const recoveryBase = resolveAccountRecoveryBaseUrl({
      ACCOUNT_RECOVERY_LINK_BASE_URL: this.config.get<string>("ACCOUNT_RECOVERY_LINK_BASE_URL"),
      MOBILE_ACCOUNT_RECOVERY_URL: this.config.get<string>("MOBILE_ACCOUNT_RECOVERY_URL"),
      AUTH_RECOVERY_DEEP_LINK_BASE: this.config.get<string>("AUTH_RECOVERY_DEEP_LINK_BASE"),
    });
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
      let recoveryLink: string;
      try {
        recoveryLink = buildAuthActionLink(recoveryBase, token, "account_recovery", process.env);
      } catch (error) {
        throw this.toDeliveryConfigException(error);
      }
      const host = authLinkHostname(recoveryBase);
      const result = await this.smtp.send({
        to: email,
        subject: "Recover your THE EYE account",
        text: [
          `${fromName} account recovery`,
          "",
          `A recovery request was made for your account at ${requestedAt}.`,
          `Use this secure link before ${expiryText}:`,
          recoveryLink,
          "",
          "If you did not request this, secure your account immediately.",
        ].join("\n"),
        html: [
          `<p><strong>${fromName}</strong></p>`,
          `<p>A recovery request was made for your account at ${requestedAt}.</p>`,
          `<p><a href="${recoveryLink}" style="display:inline-block;padding:12px 18px;background:#FF9933;color:#0B0F14;text-decoration:none;border-radius:8px;font-weight:700;">Recover account</a></p>`,
          `<p>Or copy this link:<br/><a href="${recoveryLink}">${recoveryLink}</a></p>`,
          `<p>This link expires at ${expiryText} and can be used once.</p>`,
          `<p>If you did not request this, secure your account immediately.</p>`,
        ].join(""),
      });
      if (result.status === "ProviderAccepted") {
        this.logger.log(
          `Account recovery email accepted by SMTP for ${maskEmail(email)} host=${host ?? "unknown"}`,
        );
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

  async sendAdminInvitationEmail(
    email: string,
    token: string,
    expiresAt: Date,
    context: AdminInvitationContext,
  ): Promise<void> {
    const invitationBase = resolveAdminInvitationBaseUrl({
      ADMIN_INVITATION_LINK_BASE_URL: this.config.get<string>("ADMIN_INVITATION_LINK_BASE_URL"),
    });
    if (this.smtp.isConfigured()) {
      if (!invitationBase) {
        throw new ServiceUnavailableException({
          message: "Operational account invitations are not configured for this environment.",
          code: "AUTH_ADMIN_INVITATION_LINK_BASE_MISSING",
        });
      }
      let invitationLink: string;
      try {
        invitationLink = buildAuthActionLink(invitationBase, token, "admin_invitation", process.env);
      } catch (error) {
        throw this.toDeliveryConfigException(error);
      }
      const expiryText = formatCitizenEmailTimestamp(expiresAt);
      const safeName = escapeHtml(context.displayName);
      const safeRole = escapeHtml(context.role);
      const safeOrganisation = escapeHtml(context.organisation);
      const safeScope = escapeHtml(context.scope);
      const result = await this.smtp.send({
        to: email,
        subject: "Activate your THE EYE operational account",
        text: [
          "THE EYE operational account",
          "",
          `Hello ${context.displayName},`,
          "An administrator created a THE EYE operational account for you.",
          `Assigned role: ${context.role}`,
          `Organisation: ${context.organisation}`,
          `Operational scope: ${context.scope}`,
          "",
          `Use this secure one-time link before ${expiryText} to set your password and activate the account:`,
          invitationLink,
          "",
          "For help, contact the administrator who invited you or THE EYE support through the official support channel.",
          "If you were not expecting this invitation, do not use the link.",
        ].join("\n"),
        html: [
          "<p><strong>THE EYE</strong></p>",
          `<p>Hello ${safeName},</p>`,
          "<p>An administrator created a THE EYE operational account for you.</p>",
          `<p><strong>Assigned role:</strong> ${safeRole}<br/><strong>Organisation:</strong> ${safeOrganisation}<br/><strong>Operational scope:</strong> ${safeScope}</p>`,
          `<p><a href="${invitationLink}" style="display:inline-block;padding:12px 18px;background:#FF9933;color:#0B0F14;text-decoration:none;border-radius:8px;font-weight:700;">Activate account</a></p>`,
          `<p>This one-time link expires at ${expiryText}.</p>`,
          "<p>For help, contact the administrator who invited you or THE EYE support through the official support channel.</p>",
          "<p>If you were not expecting this invitation, do not use the link.</p>",
        ].join(""),
      });
      if (result.status === "ProviderAccepted") {
        this.logger.log(`Operational account invitation accepted by SMTP for ${maskEmail(email)} host=${authLinkHostname(invitationBase) ?? "unknown"}`);
        return;
      }
      throw new ServiceUnavailableException({
        message: "Operational account invitation could not be sent. Try again shortly.",
        code: "AUTH_DELIVERY_FAILED",
      });
    }

    await this.dispatchWebhook(
      this.config.get<string>("AUTH_ADMIN_INVITATION_WEBHOOK_URL"),
      { type: "admin_invitation", email, token, expiresAt: expiresAt.toISOString() },
      "operational account invitation",
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

  private toDeliveryConfigException(error: unknown): ServiceUnavailableException {
    if (error instanceof AuthRecoveryUrlError) {
      return new ServiceUnavailableException({
        message: "Password recovery links are misconfigured for this environment.",
        code: error.code,
      });
    }
    throw error;
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
    const requiresHttps =
      appEnv === "staging" ||
      appEnv === "production" ||
      process.env.NODE_ENV === "staging" ||
      process.env.NODE_ENV === "production";
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
