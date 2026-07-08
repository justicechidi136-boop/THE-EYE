import { BadRequestException } from "@nestjs/common";
import { validateLocationUpdate } from "../dto/live-video.dto";

describe("live video location validation", () => {
  it("accepts valid emergency GPS updates", () => {
    expect(() => validateLocationUpdate({
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 8,
      speed: 1.2,
      heading: 90,
      altitude: 34,
      capturedAt: "2026-07-06T08:34:22.000Z",
    })).not.toThrow();
  });

  it("rejects invalid GPS updates", () => {
    expect(() => validateLocationUpdate({ latitude: 200, longitude: 3.3792, capturedAt: "2026-07-06T08:34:22.000Z" })).toThrow(BadRequestException);
    expect(() => validateLocationUpdate({ latitude: 6.5244, longitude: 3.3792, accuracy: -1, capturedAt: "2026-07-06T08:34:22.000Z" })).toThrow(BadRequestException);
  });
});
