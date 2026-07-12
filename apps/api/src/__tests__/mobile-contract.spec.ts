import { readFileSync } from "fs";
import { resolve } from "path";
import {
  apiEnumValues,
  mobileApiContracts,
  reportIncidentValidation,
  SmartwatchConnectivityMode,
  SmartwatchEmergencyMode,
  SmartwatchPairingMethod,
} from "@the-eye/shared";

const repoRoot = resolve(__dirname, "../../../..");

function readRepo(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("mobile contract sharing", () => {
  it("generates a contracts manifest from shared package", () => {
    const manifest = JSON.parse(readRepo("packages/shared/dist/contracts.json"));
    expect(manifest.apiVersionPrefix).toBe("/v1");
    expect(manifest.enums.IncidentType).toEqual(apiEnumValues.IncidentType);
    expect(manifest.endpoints["smartwatch.sos"].path).toBe("/smartwatch/sos");
    expect(manifest.validation).toEqual(reportIncidentValidation);
  });

  it("mirrors smartwatch enums in Dart contract file", () => {
    const dart = readRepo("apps/mobile/lib/contracts/the_eye_enums.dart");
    for (const value of Object.values(SmartwatchConnectivityMode)) {
      expect(dart.includes(`"${value}"`)).toBe(true);
    }
    for (const value of Object.values(SmartwatchEmergencyMode)) {
      expect(dart.includes(`"${value}"`)).toBe(true);
    }
    for (const value of Object.values(SmartwatchPairingMethod)) {
      expect(dart.includes(`"${value}"`)).toBe(true);
    }
  });

  it("uses shared payload field names in Dart builders", () => {
    const payloads = readRepo("apps/mobile/lib/contracts/the_eye_payloads.dart");
    const sosContract = mobileApiContracts["smartwatch.sos"].body!;
    for (const field of Object.keys(sosContract)) {
      expect(payloads.includes(`"${field}"`)).toBe(true);
    }
  });

  it("routes mobile API client through /v1 path constants", () => {
    const paths = readRepo("apps/mobile/lib/contracts/the_eye_api_paths.dart");
    expect(paths.includes("/live-video/incidents/")).toBe(true);
    expect(paths.includes("/smartwatch/devices/register")).toBe(true);
    expect(paths.includes("/incidents/report")).toBe(true);
  });

  it("aligns mobile API base URL with backend /v1 prefix", () => {
    const mobile = readRepo("apps/mobile/lib/main.dart");
    const enums = readRepo("apps/mobile/lib/contracts/the_eye_enums.dart");
    expect(mobile.includes("TheEyeApiClient")).toBe(true);
    expect(mobile.includes("TheEyeApiConfig.resolveBaseUrl()")).toBe(true);
    expect(enums.includes("http://localhost:4000/v1")).toBe(true);
    expect(mobile.includes("class IncidentTrackingItem")).toBe(true);
    expect(mobile.includes("class IncidentStatus ")).toBe(false);
  });

  it("imports smartwatch DTO enums from shared package", () => {
    const dto = readRepo("apps/api/src/modules/smartwatch/dto/smartwatch.dto.ts");
    expect(dto.includes('from "@the-eye/shared"')).toBe(true);
    expect(dto.includes("SmartwatchConnectivityMode")).toBe(true);
    expect(dto.includes("SmartwatchEmergencyMode")).toBe(true);
  });
});
