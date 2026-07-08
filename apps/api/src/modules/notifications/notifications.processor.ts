import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";

@Processor("notifications")
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    const data = job.data as any;
    const channel = data.channel ?? "push";
    const provider = data.provider ?? this.providerForChannel(channel);
    const status = channel === "sms" || channel === "email" ? "Sent" : "Delivered";
    const providerMessageId = `${provider}-${job.id}`;
    const responsePayload = {
      provider,
      placeholder: channel === "sms" || channel === "email",
      fcm: channel === "push" ? "queued-for-firebase-cloud-messaging" : undefined,
    };

    if (data.notificationId) {
      await (this.prisma as any).notificationDeliveryLog.create({
        data: {
          notificationId: data.notificationId,
          channel,
          provider,
          status,
          providerMessageId,
          requestPayload: data,
          responsePayload,
          sentAt: new Date(),
          deliveredAt: status === "Delivered" ? new Date() : undefined,
        } as never,
      });
      await this.prisma.notification.update({
        where: { id: data.notificationId },
        data: {
          status: status as never,
          provider,
          providerMessageId,
          sentAt: new Date(),
        } as never,
      });
    }

    return { provider, status, providerMessageId, payload: data };
  }

  private providerForChannel(channel: string) {
    if (channel === "push") return "firebase-cloud-messaging";
    if (channel === "sms") return "sms-placeholder";
    if (channel === "email") return "email-placeholder";
    if (channel === "watch_push") return "smartwatch-alert-adapter";
    return "in-app";
  }
}
