import { BadRequestException } from "@nestjs/common";
import { IncidentType } from "@the-eye/shared";
import { validateMediaDraft, validateReportIncidentDto } from "../dto/report-incident.dto";

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

  it("rejects descriptions shorter than five characters when no voice or media", () => {
    expect(() => validateReportIncidentDto({ ...base, description: "bad" })).toThrow(BadRequestException);
  });

  it("accepts voice-only incident reports", () => {
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
            durationSeconds: 8,
          },
        ],
      }),
    ).not.toThrow();
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

  it("rejects media list above policy limits", () => {
    expect(() =>
      validateReportIncidentDto({
        ...base,
        media: Array.from({ length: 7 }, (_, index) => ({
          mediaType: "Image" as const,
          bucket: "the-eye",
          objectKey: `evidence/inc-1/file-${index}.jpg`,
          contentType: "image/jpeg",
          fileHash: "sha256:abc",
          sizeBytes: 1024,
        })),
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects media total size above policy limit", () => {
    expect(() =>
      validateReportIncidentDto({
        ...base,
        media: [
          {
            mediaType: "Image",
            bucket: "the-eye",
            objectKey: "evidence/inc-1/file-1.jpg",
            contentType: "image/jpeg",
            fileHash: "sha256:abc",
            sizeBytes: 200 * 1024 * 1024,
          },
          {
            mediaType: "Image",
            bucket: "the-eye",
            objectKey: "evidence/inc-1/file-2.jpg",
            contentType: "image/jpeg",
            fileHash: "sha256:def",
            sizeBytes: 150 * 1024 * 1024,
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects unsupported evidence content type", () => {
    expect(() =>
      validateMediaDraft({
        mediaType: "Image",
        bucket: "the-eye",
        objectKey: "evidence/inc-1/file-1.heic",
        contentType: "image/heic",
        fileHash: "sha256:abc",
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects video duration above 120 seconds", () => {
    expect(() =>
      validateMediaDraft({
        mediaType: "Video",
        bucket: "the-eye",
        objectKey: "evidence/inc-1/file-1.mp4",
        contentType: "video/mp4",
        fileHash: "sha256:abc",
        durationSeconds: 121,
      }),
    ).toThrow(BadRequestException);
  });
});
