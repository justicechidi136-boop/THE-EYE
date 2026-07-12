import { NotificationDispatcherService } from "../notification-dispatcher.service";
import { EmailProvider } from "../providers/email.provider";
import { FcmProvider } from "../providers/fcm.provider";
import { SmsProvider } from "../providers/sms.provider";

describe("NotificationDispatcherService", () => {
  it("delivers in-app notifications without external providers", async () => {
    const dispatcher = new NotificationDispatcherService({} as FcmProvider, {} as SmsProvider, {} as EmailProvider);
    const result = await dispatcher.dispatch({
      channel: "in_app",
      title: "Status update",
      body: "Incident received",
      notificationId: "notification-1",
    });

    expect(result.status).toBe("Delivered");
    expect(result.provider).toBe("in-app");
  });
});
