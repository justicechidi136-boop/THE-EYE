import { ConfigService } from "@nestjs/config";
import { LiveKitClientUrlError } from "../livekit-client-url";
import { LiveKitTokenService } from "../livekit-token.service";

describe("LiveKitTokenService", () => {
  it("creates a signed LiveKit access token with room grants", () => {
    const values: Record<string, string> = {
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_URL: "wss://livekit.example",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://staging-livekit.example.com",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    const token = service.createToken({
      identity: "user-1",
      name: "Citizen",
      roomName: "eye-incident-1",
      canPublish: true,
      canSubscribe: false,
      lowBandwidthMode: true,
    });
    const [, payload] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    expect(token.split(".")).toHaveLength(3);
    expect(decoded.video.room).toBe("eye-incident-1");
    expect(decoded.video.canPublish).toBe(true);
    expect(decoded.video.canSubscribe).toBe(false);
    expect(JSON.parse(decoded.metadata).lowBandwidthMode).toBe(true);
  });

  it("issues unique token identifiers to prevent reuse", () => {
    const values: Record<string, string> = {
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://staging-livekit.example.com",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    const first = service.createToken({
      identity: "user-1",
      name: "Citizen",
      roomName: "eye-incident-1",
      canPublish: true,
      canSubscribe: false,
    });
    const second = service.createToken({
      identity: "user-1",
      name: "Citizen",
      roomName: "eye-incident-1",
      canPublish: true,
      canSubscribe: false,
    });
    const firstJti = JSON.parse(Buffer.from(first.split(".")[1], "base64url").toString("utf8")).jti;
    const secondJti = JSON.parse(Buffer.from(second.split(".")[1], "base64url").toString("utf8")).jti;
    expect(firstJti).not.toBe(secondJti);
  });

  it("returns public WSS URL for clients when configured", () => {
    const values: Record<string, string> = {
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_URL: "ws://livekit:7880",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://staging-livekit.example.com",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    expect(service.clientLivekitUrl()).toBe("wss://staging-livekit.example.com");
  });

  it("requires explicit public URL in staging instead of internal fallback", () => {
    const values: Record<string, string> = {
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_URL: "ws://host.docker.internal:7880",
      THE_EYE_APP_ENV: "staging",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    expect(() => service.clientLivekitUrl({ requireWss: true })).toThrow(LiveKitClientUrlError);
  });

  it("prefers LIVEKIT_PUBLIC_URL over internal LIVEKIT_URL", () => {
    const values: Record<string, string> = {
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_URL: "ws://livekit:7880",
      LIVEKIT_PUBLIC_URL: "wss://staging-livekit.example.com",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    expect(service.clientLivekitUrl()).toBe("wss://staging-livekit.example.com");
  });

  it("never returns internal docker LiveKit URL to clients", () => {
    const values: Record<string, string> = {
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_URL: "ws://livekit:7880",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    try {
      service.clientLivekitUrl();
      throw new Error("Expected clientLivekitUrl to reject internal docker URL");
    } catch (error) {
      if (error instanceof Error && error.message === "Expected clientLivekitUrl to reject internal docker URL") throw error;
      expect(String(error)).toMatch(/CLIENT_LIVEKIT_URL_INVALID|wss:\/\//);
    }
  });
});
