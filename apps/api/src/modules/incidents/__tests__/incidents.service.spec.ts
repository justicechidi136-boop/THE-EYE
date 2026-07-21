import { BadRequestException } from "@nestjs/common";
import { IncidentStatus, IncidentType } from "@the-eye/shared";
import { IncidentsService } from "../incidents.service";
import { validateIncidentLocationDto, validateReportIncidentDto } from "../dto/report-incident.dto";

describe("IncidentsService helpers", () => {
  describe("validateReportIncidentDto", () => {
    const base = {
      type: IncidentType.Crime,
      description: "Witnessed suspicious activity near the junction.",
      latitude: 6.6018,
      longitude: 3.3515,
    };

    it("accepts clientSubmissionId and occurredAt", () => {
      expect(() =>
        validateReportIncidentDto({
          ...base,
          clientSubmissionId: "mobile-draft-123",
          occurredAt: "2026-07-22T00:00:00.000Z",
        }),
      ).not.toThrow();
    });

    it("rejects more than five emergency contact ids", () => {
      expect(() =>
        validateReportIncidentDto({
          ...base,
          emergencyContactIds: ["1", "2", "3", "4", "5", "6"],
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe("validateIncidentLocationDto", () => {
    it("accepts valid coordinates", () => {
      expect(() =>
        validateIncidentLocationDto({
          latitude: 6.6018,
          longitude: 3.3515,
          accuracyMeters: 12,
        }),
      ).not.toThrow();
    });

    it("rejects invalid latitude", () => {
      expect(() =>
        validateIncidentLocationDto({
          latitude: 120,
          longitude: 3.3515,
        }),
      ).toThrow(BadRequestException);
    });
  });
});

describe("IncidentsService idempotency contract", () => {
  it("returns duplicate flag semantics from buildReportResponse", () => {
    const service = Object.create(IncidentsService.prototype) as IncidentsService;
    const response = (service as any).buildReportResponse(
      {
        id: "incident-1",
        status: IncidentStatus.Submitted,
        priority: "P2ActiveCrimeAccident",
        submittedAt: new Date("2026-07-22T00:00:00.000Z"),
      },
      false,
      true,
    );
    expect(response.duplicate).toBe(true);
    expect(response.id).toBe("incident-1");
  });
});
