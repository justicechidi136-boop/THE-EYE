import { EmergencyClassificationService } from "../emergency-classification.service";
import { EmergencyCategory } from "@the-eye/shared";

describe("Silent SOS classification", () => {
  const service = new EmergencyClassificationService();

  it("forces silent metadata for SilentSos submissions", () => {
    const classified = service.classifySosReport({
      emergencyCategory: EmergencyCategory.SilentSos,
      latitude: 6.5,
      longitude: 3.3,
      silent: true,
    });
    expect(classified.silent).toBe(true);
    expect(classified.category).toBe(EmergencyCategory.SilentSos);
  });

  it("disables emergency contact notifications for silent SOS", () => {
    const dto = service.toReportIncidentDto({
      emergencyCategory: EmergencyCategory.SilentSos,
      latitude: 6.5,
      longitude: 3.3,
      silent: true,
      notifyEmergencyContacts: true,
    });
    expect(dto.notifyEmergencyContacts).toBe(false);
  });
});
