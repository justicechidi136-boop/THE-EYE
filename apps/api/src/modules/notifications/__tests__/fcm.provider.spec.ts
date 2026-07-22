import { ConfigService } from "@nestjs/config";
import { NOTIFICATIONS_QUEUE_NAME } from "../../../common/queue/queue-names";
import {
  isFcmSimulationFlagEnabled,
  isProductionLikeFcmRuntime,
  normalizeFcmPrivateKey,
  PRODUCTION_FCM_PROJECT_ID,
  resolveFcmRuntime,
} from "../providers/fcm.config";
import { FcmProvider, isInvalidFcmTokenError, maskToken } from "../providers/fcm.provider";

describe("fcm.config", () => {
  it("normalizes escaped private-key newlines", () => {
    expect(normalizeFcmPrivateKey("-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n")).toContain(
      "\nabc\n",
    );
  });

  it("blocks simulation when FCM_MODE is real", () => {
    const config = {
      get: (key: string) => {
        if (key === "FCM_MODE") return "real";
        if (key === "FCM_ALLOW_SIMULATION") return "false";
        if (key === "FCM_SIMULATION_MODE") return "false";
        return "";
      },
    } as ConfigService;

    const runtime = resolveFcmRuntime(config);
    expect(runtime.mode).toBe("simulated");
    if (runtime.mode === "simulated") {
      expect(runtime.reason).toContain("production-like");
    }
    expect(isProductionLikeFcmRuntime(config)).toBe(true);
  });

  it("uses real mode when credentials and flags are production-safe", () => {
    const config = {
      get: (key: string) => {
        if (key === "FCM_PROJECT_ID") return PRODUCTION_FCM_PROJECT_ID;
        if (key === "FCM_CLIENT_EMAIL") return "firebase-adminsdk@test.iam.gserviceaccount.com";
        if (key === "FCM_PRIVATE_KEY") return "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";
        if (key === "FCM_MODE") return "real";
        if (key === "FCM_ALLOW_SIMULATION") return "false";
        if (key === "FCM_SIMULATION_MODE") return "false";
        return "";
      },
    } as ConfigService;

    const runtime = resolveFcmRuntime(config);
    expect(runtime.mode).toBe("real");
    if (runtime.mode === "real") {
      expect(runtime.projectId).toBe(PRODUCTION_FCM_PROJECT_ID);
    }
  });

  it("detects simulation flags", () => {
    expect(isFcmSimulationFlagEnabled("true")).toBe(true);
    expect(isFcmSimulationFlagEnabled("false")).toBe(false);
  });
});

describe("FcmProvider", () => {
  it("throws when simulated runtime is used instead of returning fake success", async () => {
    const config = {
      get: (key: string) => {
        if (key === "FCM_PROJECT_ID") return "";
        return undefined;
      },
    } as ConfigService;
    const prisma = { userPushToken: { findMany: async () => [] } } as never;
    const provider = new FcmProvider(config, prisma);

    let caught: Error | undefined;
    try {
      await provider.send({
        userId: "user-1",
        title: "Emergency nearby",
        body: "Avoid the area",
        priority: "Critical",
      });
    } catch (error) {
      caught = error as Error;
    }

    expect(caught?.message).toContain("FCM dispatch unavailable");
  });

  it("throws when production-like runtime has missing credentials", async () => {
    const config = {
      get: (key: string) => {
        if (key === "FCM_MODE") return "real";
        if (key === "FCM_ALLOW_SIMULATION") return "false";
        if (key === "FCM_SIMULATION_MODE") return "false";
        return "";
      },
    } as ConfigService;
    const prisma = { userPushToken: { findMany: async () => [] } } as never;
    const provider = new FcmProvider(config, prisma);

    let caught: Error | undefined;
    try {
      await provider.send({
        userId: "user-1",
        title: "Test",
        body: "Test",
      });
    } catch (error) {
      caught = error as Error;
    }

    expect(caught?.message).toContain("production-like");
  });

  it("deactivates invalid tokens and reports invalid_token outcome", async () => {
    const config = {
      get: (key: string) => {
        if (key === "FCM_PROJECT_ID") return PRODUCTION_FCM_PROJECT_ID;
        if (key === "FCM_CLIENT_EMAIL") return "firebase-adminsdk@test.iam.gserviceaccount.com";
        if (key === "FCM_PRIVATE_KEY") return "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";
        if (key === "FCM_MODE") return "real";
        if (key === "FCM_ALLOW_SIMULATION") return "false";
        if (key === "FCM_SIMULATION_MODE") return "false";
        return "";
      },
    } as ConfigService;

    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      userPushToken: {
        findFirst: async () => ({ token: "invalid-device-token-value", userId: "user-1" }),
        updateMany,
      },
    } as never;

    const provider = new FcmProvider(config, prisma);
    (provider as any).getAccessToken = async () => "oauth-token";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { status: "NOT_FOUND", message: "Requested entity was not found." } }),
      }) as never;

    let caught: Error | undefined;
    try {
      await provider.send({
        targetToken: "invalid-device-token-value",
        title: "Test",
        body: "Test",
      });
    } catch (error) {
      caught = error as Error;
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(updateMany).toHaveBeenCalledWith({
      where: { token: "invalid-device-token-value", isActive: true },
      data: { isActive: false },
    });
  });

  it("masks tokens in helper output", () => {
    expect(maskToken("abcdefghijklmnopqrstuvwxyz")).toBe("...stuvwxyz");
  });

  it("classifies invalid FCM token errors", () => {
    expect(isInvalidFcmTokenError("NOT_FOUND", "Requested entity was not found.")).toBe(true);
    expect(isInvalidFcmTokenError("PERMISSION_DENIED", "Caller does not have permission")).toBe(false);
  });

  it("rejects cross-environment push tokens before FCM send", async () => {
    const config = {
      get: (key: string) => {
        if (key === "THE_EYE_APP_ENV") return "production";
        if (key === "FCM_PROJECT_ID") return PRODUCTION_FCM_PROJECT_ID;
        if (key === "FCM_CLIENT_EMAIL") return "firebase-adminsdk@test.iam.gserviceaccount.com";
        if (key === "FCM_PRIVATE_KEY") return "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";
        if (key === "FCM_MODE") return "real";
        if (key === "FCM_ALLOW_SIMULATION") return "false";
        if (key === "FCM_SIMULATION_MODE") return "false";
        return "";
      },
    } as ConfigService;

    const prisma = {
      userPushToken: {
        findMany: async () => [{ token: "staging-device-token", userId: "user-1", appEnvironment: "staging" }],
      },
    } as never;

    const provider = new FcmProvider(config, prisma);
    (provider as any).getAccessToken = async () => "oauth-token";

    let caught: Error | undefined;
    try {
      await provider.send({
        userId: "user-1",
        title: "Test",
        body: "Test",
      });
    } catch (error) {
      caught = error as Error;
    }

    expect(caught?.message).toContain("staging");
    expect(caught?.message).toContain("production");
  });
});
