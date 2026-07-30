import { IncidentType } from "@the-eye/shared";
import {
  buildCanonicalAlertId,
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

  it("builds v1 payload with canonical alert identity", () => {
    const payload = buildDangerZoneAlertPayload({
      zoneId: "zone-1",
      incidentId: "inc-1",
      safetyAlertId: "alert-1",
      userId: "user-1",
      deviceId: "device-1",
      incidentType: IncidentType.Crime,
      alertState: "InsideDangerZone",
      distanceMeters: 420.7,
      areaName: "Ikeja",
      languageHint: "pcm-NG",
      version: 2,
      sequence: 2,
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.alertId).toBe(buildCanonicalAlertId("zone-1", "user-1", "device-1"));
    expect(payload.version).toBe(2);
    expect(payload.sequence).toBe(2);
    expect(payload.state).toBe("ESCALATED");
    expect(payload.alertCode).toBe("DANGER_ZONE_ARMED_ROBBERY_NEARBY");
    expect(payload.distanceMeters).toBe(421);
  });

  it("serializes canonical identity to FCM string map", () => {
    const payload = buildDangerZoneAlertPayload({
      zoneId: "zone-1",
      incidentId: "inc-1",
      safetyAlertId: "alert-1",
      userId: "user-1",
      allClear: true,
    });
    const data = dangerAlertPayloadToFcmData(payload);
    expect(data.dangerAlertCode).toBe("DANGER_ZONE_CLEARED");
    expect(data.alertId.length).toBeGreaterThan(0);
    expect(data.alertVersion).toBe("1");
    expect(data.alertLifecycleState).toBe("CLEARED");
  });

  it("rejects untrusted alert codes", () => {
    expect(
      validateDangerAlertPayload({
        schemaVersion: 1,
        alertCode: "ARBITRARY_SPEECH",
        type: "DANGER_ZONE_ALERT",
        alertId: "alert-1",
        version: 1,
        sequence: 1,
        state: "ACTIVE",
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
        alertId: "alert-1",
        version: 1,
        sequence: 1,
        state: "ACTIVE",
        incidentId: "inc-1",
        zoneId: "zone-1",
        safetyAlertId: "alert-1",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toBe(null);
  });
});
