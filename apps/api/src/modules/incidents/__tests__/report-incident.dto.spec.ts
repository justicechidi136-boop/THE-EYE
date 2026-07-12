import { BadRequestException } from "@nestjs/common";
import { IncidentType } from "@the-eye/shared";
import { validateReportIncidentDto } from "../dto/report-incident.dto";

describe("validateReportIncidentDto", () => {
  const base = {
    type: IncidentType.Crime,
    description: "Witnessed suspicious activity near the junction.",
    latitude: 6.6018,
    longitude: 3.3515,
  };

  it("accepts a valid mobile-aligned payload", () => {
    expect(() => validateReportIncidentDto(base)).not.toThrow();
  });

  it("rejects descriptions shorter than five characters", () => {
    expect(() => validateReportIncidentDto({ ...base, description: "bad" })).toThrow(BadRequestException);
  });

  it("requires missing person full name", () => {
    expect(() =>
      validateReportIncidentDto({
        ...base,
        type: IncidentType.MissingPerson,
        description: "Missing person report submitted via mobile.",
      }),
    ).toThrow(BadRequestException);
  });

  it("requires stolen vehicle plate number", () => {
    expect(() =>
      validateReportIncidentDto({
        ...base,
        type: IncidentType.StolenVehicle,
        description: "Stolen vehicle report submitted via mobile.",
        stolenVehicle: { plateNumber: "", make: "Toyota", model: "Corolla" },
      }),
    ).toThrow(BadRequestException);
  });
});
