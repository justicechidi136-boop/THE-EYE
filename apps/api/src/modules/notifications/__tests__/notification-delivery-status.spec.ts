import {
  mapBroadcastDeliveryStatusFromProvider,
  mapProviderResultToDeliveryLogStatus,
  mapProviderResultToNotificationStatus,
} from "../notification-delivery-status";

describe("notification-delivery-status", () => {
  it("maps provider acceptance to ProviderAccepted without marking Delivered", () => {
    const logStatus = mapProviderResultToDeliveryLogStatus({
      status: "Sent",
      provider: "firebase-cloud-messaging",
      providerMessageId: "projects/test/messages/1",
    });
    const notificationStatus = mapProviderResultToNotificationStatus({
      status: "Sent",
      provider: "firebase-cloud-messaging",
    });

    expect(logStatus).toBe("ProviderAccepted");
    expect(notificationStatus).toBe("Sent");
  });

  it("maps simulated payloads to Failed", () => {
    expect(
      mapProviderResultToDeliveryLogStatus({
        status: "Sent",
        provider: "firebase-cloud-messaging",
        responsePayload: { simulated: true },
      }),
    ).toBe("Failed");
  });

  it("maps in-app delivery to Delivered", () => {
    expect(
      mapProviderResultToDeliveryLogStatus({
        status: "Delivered",
        provider: "in-app",
      }),
    ).toBe("Delivered");
    expect(
      mapBroadcastDeliveryStatusFromProvider({
        status: "Delivered",
        provider: "in-app",
      }),
    ).toBe("Delivered");
  });
});
