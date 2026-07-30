import { BadRequestException } from "@nestjs/common";
import { IncidentType } from "@the-eye/shared";
import { hasValidReportNarrative, validateReportIncidentDto } from "../../incidents/dto/report-incident.dto";

describe("validateReportIncidentDto voice-first", () => {
  const base = {
    type: IncidentType.Crime,
    latitude: 6.6018,
    longitude: 3.3515,
  };

  it("accepts voice-only reports without typed description", () => {
    expect(() =>
      validateReportIncidentDto({
        ...base,
        media: [
          {
            mediaType: "Audio",
            bucket: "the-eye",
            objectKey: "evidence/inc-1/file.m4a",
            contentType: "audio/mp4",
            fileHash: "sha256:abc",
            durationSeconds: 12,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects reports with no description, voice, or image/video", () => {
    expect(() => validateReportIncidentDto({ ...base, description: "bad" })).toThrow(BadRequestException);
  });

  it("hasValidReportNarrative accepts image evidence without text", () => {
    expect(
      hasValidReportNarrative({
        description: "",
        media: [
          {
            mediaType: "Image",
            bucket: "the-eye",
            objectKey: "evidence/inc-1/file.jpg",
            contentType: "image/jpeg",
            fileHash: "sha256:abc",
          },
        ],
      }),
    ).toBe(true);
  });
});
