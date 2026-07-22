import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationDispatchError } from "../notification-dispatch.error";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "../notification.types";

@Injectable()
export class EmailProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async send(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const disabled = this.config.get<string>("EMAIL_PROVIDER_DISABLED", "true") !== "false";
    const email = await this.resolveEmail(payload);

    if (!email) {
      throw new NotificationDispatchError("Email delivery requires an email address", "email-placeholder", false);
    }

    if (disabled) {
      throw new NotificationDispatchError(
        "Email provider is disabled. Configure EMAIL_PROVIDER_DISABLED=false and a real email integration.",
        "email-placeholder",
        false,
        { placeholder: true, email },
      );
    }

    throw new NotificationDispatchError(
      "Email provider is enabled but no production email integration is configured",
      "email-placeholder",
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
