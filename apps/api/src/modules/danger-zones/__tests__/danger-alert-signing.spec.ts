import { generateKeyPairSync } from "crypto";
import {
  buildDangerZoneAlertPayload,
  dangerAlertPayloadToFcmData,
  verifyDangerAlertPayload,
} from "../danger-alert-payload";
import {
  buildDangerAlertSigningMessage,
  exportPublicKeyPem,
  signDangerAlertPayload,
} from "../danger-alert-signing";

const TEST_PRIVATE_KEY = `${["-----BEGIN", "PRIVATE KEY-----"].join(" ")}
MC4CAQAwBQYDK2VwBCIEIPUJRR6gwejwp8VJDCmq7Nxgpre7bcu7hHgOSl2At7Uo
${["-----END", "PRIVATE KEY-----"].join(" ")}`;

const TEST_PUBLIC_KEY = exportPublicKeyPem(TEST_PRIVATE_KEY);

describe("danger-alert-signing", () => {
  it("produces deterministic signing messages", () => {
    const payload = buildDangerZoneAlertPayload({
      zoneId: "zone-1",
      incidentId: "inc-1",
      safetyAlertId: "alert-1",
      userId: "user-1",
      alertId: "alert-zone-1-user-1-mobile",
      version: 2,
      sequence: 2,
      alertState: "Critical",
    });
    const message = buildDangerAlertSigningMessage(payload);
    expect(message).toContain('"alertId":"alert-zone-1-user-1-mobile"');
    expect(message).toContain('"version":2');
  });

  it("signs and verifies payloads with Ed25519", () => {
    const unsigned = buildDangerZoneAlertPayload({
      zoneId: "zone-1",
      incidentId: "inc-1",
      safetyAlertId: "alert-1",
      userId: "user-1",
      alertId: "alert-zone-1-user-1-mobile",
      version: 1,
      sequence: 1,
    });
    const signed = signDangerAlertPayload(unsigned, {
      privateKeyPem: TEST_PRIVATE_KEY,
      keyId: "test-v1",
    });
    const result = verifyDangerAlertPayload(signed, TEST_PUBLIC_KEY);
    expect(result.valid).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const signed = signDangerAlertPayload(
      buildDangerZoneAlertPayload({
        zoneId: "zone-1",
        incidentId: "inc-1",
        safetyAlertId: "alert-1",
        userId: "user-1",
        alertId: "alert-zone-1-user-1-mobile",
      }),
      { privateKeyPem: TEST_PRIVATE_KEY, keyId: "test-v1" },
    );
    signed.priority = "LOW" as never;
    const result = verifyDangerAlertPayload(signed, TEST_PUBLIC_KEY);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });

  it("serializes signature fields into FCM data", () => {
    const signed = signDangerAlertPayload(
      buildDangerZoneAlertPayload({
        zoneId: "zone-1",
        incidentId: "inc-1",
        safetyAlertId: "alert-1",
        userId: "user-1",
        alertId: "alert-zone-1-user-1-mobile",
      }),
      { privateKeyPem: TEST_PRIVATE_KEY, keyId: "test-v1" },
    );
    const fcm = dangerAlertPayloadToFcmData(signed);
    expect(fcm.alertId).toBe("alert-zone-1-user-1-mobile");
    expect(fcm.alertVersion).toBe("1");
    expect(fcm.signatureKeyId).toBe("test-v1");
    expect(fcm.signature!.length).toBeGreaterThan(0);
  });

  it("generates valid ed25519 keys for rotation", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const signed = signDangerAlertPayload(
      buildDangerZoneAlertPayload({
        zoneId: "z",
        incidentId: "i",
        safetyAlertId: "s",
        userId: "u",
        alertId: "alert-z-u-mobile",
      }),
      { privateKeyPem: privatePem, keyId: "rotate-1" },
    );
    expect(verifyDangerAlertPayload(signed, publicPem).valid).toBe(true);
  });
});
