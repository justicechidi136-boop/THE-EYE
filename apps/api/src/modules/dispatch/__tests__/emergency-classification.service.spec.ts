import { BadRequestException } from "@nestjs/common";
import { EmergencyCategory, IncidentAssignmentStatus, IncidentType } from "@the-eye/shared";
import { canTransitionAssignment } from "../assignment-lifecycle";
import { classifyEmergencyCategory } from "../emergency-category";
import { EmergencyClassificationService } from "../emergency-classification.service";
import { validateSosReportDto } from "../dto/dispatch.dto";

describe("EmergencyClassificationService", () => {
  const service = new EmergencyClassificationService();

  it("maps medical SOS to Medical incident type", () => {
    const result = service.classifySosReport({
      emergencyCategory: EmergencyCategory.Medical,
      latitude: 6.6,
      longitude: 3.35,
      medicalIndicators: true,
    });
    expect(result.incidentType).toBe(IncidentType.Medical);
    expect(result.suggestedAgencyTypes).toContain("ambulance");
  });

  it("forces silent mode for SilentSos category", () => {
    const result = service.classifySosReport({
      emergencyCategory: EmergencyCategory.SilentSos,
      latitude: 6.6,
      longitude: 3.35,
    });
    expect(result.silent).toBe(true);
    expect(result.incidentType).toBe(IncidentType.SOS);
  });

  it("requires description for Other category", () => {
    expect(() =>
      validateSosReportDto({
        emergencyCategory: EmergencyCategory.Other,
        latitude: 6.6,
        longitude: 3.35,
      }),
    ).toThrow(BadRequestException);
  });
});

describe("classifyEmergencyCategory", () => {
  it("maps domestic violence to Abuse type", () => {
    const result = classifyEmergencyCategory(EmergencyCategory.DomesticViolence);
    expect(result.incidentType).toBe(IncidentType.Abuse);
  });
});

describe("assignment lifecycle", () => {
  it("allows Assigned to Accepted", () => {
    expect(canTransitionAssignment(IncidentAssignmentStatus.Assigned, IncidentAssignmentStatus.Accepted)).toBe(true);
  });

  it("blocks Completed to Accepted", () => {
    expect(canTransitionAssignment(IncidentAssignmentStatus.Completed, IncidentAssignmentStatus.Accepted)).toBe(false);
  });
});
