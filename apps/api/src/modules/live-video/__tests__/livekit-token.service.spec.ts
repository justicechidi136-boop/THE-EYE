import { ConfigService } from "@nestjs/config";
import { LiveKitTokenService } from "../livekit-token.service";

describe("LiveKitTokenService", () => {
  it("creates a signed LiveKit access token with room grants", () => {
    const values: Record<string, string> = {
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_URL: "wss://livekit.example",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    const token = service.createToken({ identity: "user-1", name: "Citizen", roomName: "eye-incident-1", canPublish: true, canSubscribe: false, lowBandwidthMode: true });
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
      LIVEKIT_URL: "wss://livekit.example",
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new LiveKitTokenService(config);
    const first = service.createToken({ identity: "user-1", name: "Citizen", roomName: "eye-incident-1", canPublish: true, canSubscribe: false });
    const second = service.createToken({ identity: "user-1", name: "Citizen", roomName: "eye-incident-1", canPublish: true, canSubscribe: false });
    const firstJti = JSON.parse(Buffer.from(first.split(".")[1], "base64url").toString("utf8")).jti;
    const secondJti = JSON.parse(Buffer.from(second.split(".")[1], "base64url").toString("utf8")).jti;
    expect(firstJti).not.toBe(secondJti);
  });
});
