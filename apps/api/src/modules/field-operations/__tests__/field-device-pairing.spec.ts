import { BadRequestException } from "@nestjs/common";
import { generateKeyPairSync, sign } from "crypto";
import { FIELD_ERROR_CODES, FIELD_PAIRING_ERROR_CODES, FieldPairingTokenStatus, FieldProvisioningMode } from "@the-eye/shared";
import { hashToken } from "../../../common/auth/crypto";
import { FieldDevicePairingService } from "../field-device-pairing.service";

/** Raw 32-byte Ed25519 public key as base64 — matches verifyFieldDeviceSignature. */
function createDeviceKeyMaterial() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const rawPublicKey = spki.subarray(spki.length - 32);
  const publicKeyBase64 = rawPublicKey.toString("base64");
  const signChallenge = (challenge: string) =>
    sign(null, Buffer.from(challenge, "utf8"), privateKey).toString("base64");
  return { publicKeyBase64, signChallenge };
}

describe("FieldDevicePairingService", () => {
  function createService() {
    const prisma = {
      fieldDevicePairingToken: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn(),
      },
      fieldDevice: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      fieldDeviceSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
      $transaction: jest.fn(),
      $queryRawUnsafe: jest.fn(),
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
    const audit = { record: jest.fn() };
    const devices = {
      createRegistrationChallenge: jest.fn(),
      consumeChallenge: jest.fn(),
    };
    const devicesAdmin = {
      assertSupervisor: jest.fn(),
      requireScopedDevice: jest.fn(),
    };
    const launcherPolicy = {
      applyPairingDefaults: jest.fn(),
    };

    const service = new FieldDevicePairingService(
      prisma as never,
      audit as never,
      devices as never,
      devicesAdmin as never,
      launcherPolicy as never,
    );

    return { prisma, audit, devices, devicesAdmin, launcherPolicy, service };
  }

  const actor = { sub: "admin-1", typ: "admin" as const, role: "Agency Admin" };

  describe("issuePairingCode", () => {
    it("refuses to issue a pairing code for a device with no permission profile assigned", async () => {
      const { service, devicesAdmin } = createService();
      devicesAdmin.requireScopedDevice.mockResolvedValue({
        id: "device-1",
        provisioningMode: FieldProvisioningMode.PreProvisioned,
        permissionProfileId: null,
        publicKey: null,
        installationIdHash: null,
      });

      await expect(service.issuePairingCode(actor, "device-1", {})).rejects.toThrow(BadRequestException);
    });

    it("refuses to issue a pairing code for an already-bound device", async () => {
      const { service, devicesAdmin } = createService();
      devicesAdmin.requireScopedDevice.mockResolvedValue({
        id: "device-1",
        provisioningMode: FieldProvisioningMode.PreProvisioned,
        permissionProfileId: "profile-1",
        publicKey: "already-bound-key",
        installationIdHash: "hash",
      });

      await expect(service.issuePairingCode(actor, "device-1", {})).rejects.toThrow(BadRequestException);
    });

    it("issues a token+short code and returns the plaintext exactly once", async () => {
      const { service, devicesAdmin, prisma } = createService();
      devicesAdmin.requireScopedDevice.mockResolvedValue({
        id: "device-1",
        provisioningMode: FieldProvisioningMode.PreProvisioned,
        permissionProfileId: "profile-1",
        publicKey: null,
        installationIdHash: null,
        preProvisionStatus: "Draft",
      });

      const result = await service.issuePairingCode(actor, "device-1", {});

      expect(prisma.fieldDevicePairingToken.create).toHaveBeenCalledTimes(1);
      const createData = prisma.fieldDevicePairingToken.create.mock.calls[0][0].data;
      expect(createData.tokenHash).not.toEqual(result.data.pairingToken);
      expect(createData.shortCodeHash).not.toEqual(result.data.shortCode);
      expect(result.data.shortCode).toMatch(/^EYE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(typeof result.data.pairingToken).toBe("string");
      expect(result.data.pairingToken.length).toBeGreaterThan(0);
    });

    it("atomically revokes the old active pairing code before creating a replacement", async () => {
      const { service, devicesAdmin, prisma } = createService();
      devicesAdmin.requireScopedDevice.mockResolvedValue({
        id: "device-1",
        publicDeviceId: "fd_abc123",
        provisioningMode: FieldProvisioningMode.PreProvisioned,
        permissionProfileId: "profile-1",
        publicKey: null,
        installationIdHash: null,
        preProvisionStatus: "AwaitingPairing",
      });
      prisma.fieldDevicePairingToken.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      await service.regeneratePairing(actor, "device-1", {});

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.fieldDevicePairingToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fieldDeviceId: "device-1",
            status: expect.objectContaining({ in: [FieldPairingTokenStatus.Issued, FieldPairingTokenStatus.Claimed] }),
          }),
          data: expect.objectContaining({ status: FieldPairingTokenStatus.Revoked, revokedReason: "superseded" }),
        }),
      );
      expect(prisma.fieldDevicePairingToken.create).toHaveBeenCalledTimes(1);
    });

    it("deactivates the device and revokes all active codes when duplicates are detected", async () => {
      const { service, devicesAdmin, prisma } = createService();
      devicesAdmin.requireScopedDevice.mockResolvedValue({
        id: "device-1",
        publicDeviceId: "fd_abc123",
        provisioningMode: FieldProvisioningMode.PreProvisioned,
        permissionProfileId: "profile-1",
        publicKey: null,
        installationIdHash: null,
      });
      prisma.fieldDevicePairingToken.count.mockResolvedValueOnce(2);

      await expect(service.regeneratePairing(actor, "device-1", {})).rejects.toMatchObject({
        response: expect.objectContaining({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID }),
      });

      expect(prisma.fieldDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationStatus: "Deactivated",
            deactivationReason: "DUPLICATE_ACTIVE_ACTIVATION_CODES",
            requiresRePair: true,
          }),
        }),
      );
      expect(prisma.fieldDevicePairingToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: FieldPairingTokenStatus.Revoked,
            revokedReason: "DUPLICATE_ACTIVE_ACTIVATION_CODES",
          }),
        }),
      );
      expect(prisma.fieldDeviceSession.updateMany).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "DEVICE_DUPLICATE_ACTIVE_CODE_DETECTED" }),
        }),
      );
      expect(prisma.fieldDevicePairingToken.create).not.toHaveBeenCalled();
    });
  });

  describe("claim / challenge / complete", () => {
    function issuedToken(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: "token-1",
        fieldDeviceId: "device-1",
        status: FieldPairingTokenStatus.Issued,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptCount: 0,
        maxAttempts: 5,
        issuedById: "admin-1",
        ...overrides,
      };
    }

    it("rejects a claim with an unknown token hash", async () => {
      const { service, prisma } = createService();
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(null);

      await expect(service.claim({ pairingToken: "does-not-exist" })).rejects.toMatchObject({
        response: expect.objectContaining({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID }),
      });
    });

    it("rejects claiming an expired token", async () => {
      const { service, prisma } = createService();
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(
        issuedToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.claim({ pairingToken: "expired-token" })).rejects.toMatchObject({
        response: expect.objectContaining({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_EXPIRED }),
      });
    });

    it("rejects replaying an already-completed token", async () => {
      const { service, prisma } = createService();
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(
        issuedToken({ status: FieldPairingTokenStatus.Completed }),
      );

      await expect(service.claim({ pairingToken: "used-token" })).rejects.toMatchObject({
        response: expect.objectContaining({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_ALREADY_USED }),
      });
    });

    it("marks an issued token as claimed and returns device summary", async () => {
      const { service, prisma } = createService();
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(issuedToken());
      prisma.fieldDevice.findUnique.mockResolvedValue({
        id: "device-1",
        publicDeviceId: "fd_abc123",
        deviceName: "Patrol Tablet 07",
        operationalRole: "PatrolOfficer",
      });

      const result = await service.claim({ pairingToken: "valid-token" });

      expect(prisma.fieldDevicePairingToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: FieldPairingTokenStatus.Claimed }) }),
      );
      expect(result.data.publicDeviceId).toBe("fd_abc123");
    });

    it("rejects a challenge request before the token has been claimed", async () => {
      const { service, prisma } = createService();
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(issuedToken({ status: FieldPairingTokenStatus.Issued }));

      await expect(service.challenge({ pairingToken: "not-claimed-yet" })).rejects.toMatchObject({
        response: expect.objectContaining({ code: FIELD_PAIRING_ERROR_CODES.TOKEN_INVALID }),
      });
    });

    it("rejects completion when the device signature is invalid, and counts the failed attempt", async () => {
      const { service, prisma, devices } = createService();
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(issuedToken({ status: FieldPairingTokenStatus.Claimed }));
      prisma.fieldDevicePairingToken.update.mockResolvedValue({ attemptCount: 1, maxAttempts: 5 });
      devices.consumeChallenge.mockResolvedValue(undefined);

      await expect(
        service.complete({
          pairingToken: "claimed-token",
          challengeId: "challenge-1",
          challenge: "abc",
          challengeSignature: "bad-signature",
          publicKey: "pk",
          installationIdHash: "hash-1",
        }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: FIELD_ERROR_CODES.DEVICE_SIGNATURE_INVALID }) });

      expect(prisma.fieldDevicePairingToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attemptCount: { increment: 1 } }) }),
      );
    });

    it("rejects completion when the installationIdHash is already bound to a different device (duplicate binding)", async () => {
      const { service, prisma, devices } = createService();
      const keys = createDeviceKeyMaterial();
      const challenge = "abc";
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(issuedToken({ status: FieldPairingTokenStatus.Claimed }));
      devices.consumeChallenge.mockResolvedValue(undefined);
      prisma.fieldDevice.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where.installationIdHash) return { id: "other-device-id" };
        return null;
      });

      await expect(
        service.complete({
          pairingToken: "claimed-token",
          challengeId: "challenge-1",
          challenge,
          challengeSignature: keys.signChallenge(challenge),
          publicKey: keys.publicKeyBase64,
          installationIdHash: "hash-already-used",
        }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: FIELD_PAIRING_ERROR_CODES.DEVICE_ALREADY_BOUND }) });
    });

    it("binds the device and activates immediately under AutoActivateOnPairing", async () => {
      const { service, prisma, devices, launcherPolicy, audit } = createService();
      const keys = createDeviceKeyMaterial();
      const challenge = "abc";
      prisma.fieldDevicePairingToken.findFirst.mockResolvedValue(issuedToken({ status: FieldPairingTokenStatus.Claimed }));
      devices.consumeChallenge.mockResolvedValue(undefined);
      prisma.fieldDevice.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where.installationIdHash) return null;
        if (where.id === "device-1") {
          return {
            id: "device-1",
            publicKey: null,
            installationIdHash: null,
            serialHash: null,
            deviceName: "Provisioned Tablet",
            manufacturer: null,
            model: null,
            androidVersion: null,
            appVersion: null,
            buildNumber: null,
            packageName: null,
            appEnvironment: null,
            activationPolicy: "AutoActivateOnPairing",
            authoritySnapshot: { grantedByAdminId: "admin-1" },
            operationalRole: "PatrolOfficer",
            deviceMode: "standard",
            registrationStatus: "PendingApproval",
            approvedAt: null,
            approvedById: null,
          };
        }
        return null;
      });
      prisma.fieldDevice.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        publicDeviceId: "fd_abc123",
        ...data,
      }));

      const result = await service.complete({
        pairingToken: "claimed-token",
        challengeId: "challenge-1",
        challenge,
        challengeSignature: keys.signChallenge(challenge),
        publicKey: keys.publicKeyBase64,
        installationIdHash: "hash-new",
      });

      expect(result.data.requiresFinalApproval).toBe(false);
      expect(result.data.registrationStatus).toBe("Active");
      expect(launcherPolicy.applyPairingDefaults).toHaveBeenCalledWith("device-1", "PatrolOfficer", "standard");
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "field.device.pairing_claim_completed" }),
      );
      expect(prisma.fieldDevicePairingToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: FieldPairingTokenStatus.Completed }) }),
      );
    });
  });

  describe("hashing", () => {
    it("never stores the plaintext token or short code", () => {
      expect(hashToken("some-secret")).not.toEqual("some-secret");
      expect(hashToken("some-secret")).toHaveLength(64);
    });
  });
});
