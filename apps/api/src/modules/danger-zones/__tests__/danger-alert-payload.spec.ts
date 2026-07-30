import { IncidentType } from "@the-eye/shared";
import {
  buildDangerZoneAlertPayload,
  dangerAlertPayloadToFcmData,
  resolveDangerAlertCode,
  validateDangerAlertPayload,
} from "../danger-alert-payload";

describe("danger-alert-payload", () => {
  it("maps kidnapping incidents to kidnapping alert code", () => {
    expect(
      resolveDangerAlertCode({ incidentType: IncidentType.Kidnapping, alertState: "Critical" }),
    ).toBe("DANGER_ZONE_KIDNAPPING_NEARBY");
  });

  it("builds v1 payload with safe fields only", () => {
    const payload = buildDangerZoneAlertPayload({
      zoneId: "zone-1",
      incidentId: "inc-1",
      safetyAlertId: "alert-1",
      incidentType: IncidentType.Crime,
      alertState: "InsideDangerZone",
      distanceMeters: 420.7,
      areaName: "Ikeja",
      languageHint: "pcm-NG",
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.alertCode).toBe("DANGER_ZONE_ARMED_ROBBERY_NEARBY");
    expect(payload.distanceMeters).toBe(421);
    expect(payload.areaName).toBe("Ikeja");
    expect(payload.languageHint).toBe("pcm-NG");
  });

  it("serializes to FCM string map", () => {
    const payload = buildDangerZoneAlertPayload({
      zoneId: "zone-1",
      incidentId: "inc-1",
      safetyAlertId: "alert-1",
      allClear: true,
    });
    const data = dangerAlertPayloadToFcmData(payload);
    expect(data.dangerAlertCode).toBe("DANGER_ZONE_CLEARED");
    expect(data.allClear).toBe("true");
  });

  it("rejects untrusted alert codes", () => {
    expect(
      validateDangerAlertPayload({
        schemaVersion: 1,
        alertCode: "ARBITRARY_SPEECH",
        type: "DANGER_ZONE_ALERT",
        incidentId: "inc-1",
        zoneId: "zone-1",
        safetyAlertId: "alert-1",
      }),
    ).toBe(null);
  });

  it("rejects expired payloads", () => {
    expect(
      validateDangerAlertPayload({
        schemaVersion: 1,
        alertCode: "DANGER_ZONE_GENERAL_ENTRY",
        type: "DANGER_ZONE_ALERT",
        incidentId: "inc-1",
        zoneId: "zone-1",
        safetyAlertId: "alert-1",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toBe(null);
  });
});
