import { BadRequestException } from "@nestjs/common";
import { validateSmartwatchGpsDto, validateRegisterSmartwatchDeviceDto, validateSmartwatchSosDto } from "../dto/smartwatch.dto";

describe("smartwatch dto validation", () => {
  it("requires a provider and device id for pairing", () => {
    expect(() => validateRegisterSmartwatchDeviceDto({ deviceId: "", provider: "" })).toThrow(BadRequestException);
  });

  it("rejects invalid GPS coordinates", () => {
    expect(() => validateSmartwatchGpsDto({ latitude: 91, longitude: 3.3792 })).toThrow(BadRequestException);
    expect(() => validateSmartwatchGpsDto({ latitude: 6.5244, longitude: 181 })).toThrow(BadRequestException);
  });

  it("requires a 3 second SOS long press and a supported emergency mode", () => {
    expect(() => validateSmartwatchSosDto({ latitude: 6.5244, longitude: 3.3792, longPressDurationMs: 1200 })).toThrow(BadRequestException);
    expect(() => validateSmartwatchSosDto({ latitude: 6.5244, longitude: 3.3792, emergencyMode: "MedicalSOS", longPressDurationMs: 3000 })).not.toThrow();
  });
});
