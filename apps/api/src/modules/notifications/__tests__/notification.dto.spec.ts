import { validateCreateNotificationDto } from "../dto/notification.dto";

describe("validateCreateNotificationDto", () => {
  it("accepts incident communication notification types", () => {
    validateCreateNotificationDto({
      type: "IncidentMessageReceived",
      title: "New message",
      body: "Open your active emergency.",
      userId: "user-1",
    });
    validateCreateNotificationDto({
      type: "IncidentInformationRequest",
      title: "Information requested",
      body: "Dispatch needs additional details.",
      userId: "user-1",
    });
  });
});
