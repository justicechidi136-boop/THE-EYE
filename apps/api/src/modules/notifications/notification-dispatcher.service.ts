import { Injectable } from "@nestjs/common";
import { NotificationDispatchError } from "./notification-dispatch.error";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "./notification.types";
import { EmailProvider } from "./providers/email.provider";
import { FcmProvider } from "./providers/fcm.provider";
import { SmsProvider } from "./providers/sms.provider";

@Injectable()
export class NotificationDispatcherService {
  constructor(
    private readonly fcm: FcmProvider,
    private readonly sms: SmsProvider,
    private readonly email: EmailProvider,
  ) {}

  async dispatch(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const channel = payload.channel ?? "push";

    switch (channel) {
      case "push":
      case "watch_push":
        return this.fcm.send({ ...payload, channel: "push" });
      case "sms":
        return this.sms.send(payload);
      case "email":
        return this.email.send(payload);
      case "in_app":
        return {
          status: "Delivered",
          provider: "in-app",
          providerMessageId: payload.notificationId ? `in-app-${payload.notificationId}` : undefined,
          responsePayload: { stored: true },
        };
      default:
        throw new NotificationDispatchError(`Unsupported notification channel: ${channel}`, "unknown", false);
    }
  }
}
