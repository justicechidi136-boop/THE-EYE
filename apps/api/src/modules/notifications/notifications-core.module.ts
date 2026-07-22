import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationDeliveryService } from "./notification-delivery.service";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { EmailProvider } from "./providers/email.provider";
import { FcmProvider } from "./providers/fcm.provider";
import { SmsProvider } from "./providers/sms.provider";

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationDispatcherService,
    NotificationDeliveryService,
    FcmProvider,
    SmsProvider,
    EmailProvider,
  ],
  exports: [
    NotificationDispatcherService,
    NotificationDeliveryService,
    FcmProvider,
    SmsProvider,
    EmailProvider,
  ],
})
export class NotificationsCoreModule {}
