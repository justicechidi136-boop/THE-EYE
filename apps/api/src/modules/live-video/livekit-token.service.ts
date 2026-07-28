import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID } from "crypto";
import { LiveVideoErrorCode } from "./live-video.errors";
import { assertClientLivekitUrl, LiveKitClientUrlError } from "./livekit-client-url";

type LiveKitGrant = {
  room: string;
  roomJoin: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
};

@Injectable()
export class LiveKitTokenService {
  constructor(private readonly config: ConfigService) {}

  createToken(input: {
    identity: string;
    name: string;
    roomName: string;
    canPublish: boolean;
    canSubscribe: boolean;
    lowBandwidthMode?: boolean;
  }) {
    const apiKey = this.config.get<string>("LIVEKIT_API_KEY", "dev-livekit-key");
    const apiSecret = this.config.get<string>("LIVEKIT_API_SECRET", "dev-livekit-secret");
    const ttlSeconds = Number(this.config.get<string>("LIVEKIT_TOKEN_TTL_SECONDS", "1800"));
    const now = Math.floor(Date.now() / 1000);
    const grant: LiveKitGrant = {
      room: input.roomName,
      roomJoin: true,
      canPublish: input.canPublish,
      canSubscribe: input.canSubscribe,
      canPublishData: true,
    };
    const payload = {
      iss: apiKey,
      sub: input.identity,
      name: input.name,
      iat: now,
      nbf: now,
      exp: now + ttlSeconds,
      jti: randomUUID(),
      video: grant,
      metadata: JSON.stringify({
        lowBandwidthMode: input.lowBandwidthMode ?? false,
        issuedAt: now,
      }),
    };
    return signJwt(payload, apiSecret);
  }

  /** Internal Docker/network URL — never returned to mobile clients. */
  livekitUrl() {
    return this.config.get<string>("LIVEKIT_URL", "wss://livekit.local");
  }

  /** Public WSS URL returned to mobile/watch/admin clients. */
  clientLivekitUrl(options: { requireWss?: boolean } = {}) {
    const publicUrl = String(this.config.get<string>("NEXT_PUBLIC_LIVEKIT_URL", "") ?? "").trim();
    if (publicUrl) {
      return assertClientLivekitUrl(publicUrl, options);
    }
    const fallback = this.livekitUrl();
    return assertClientLivekitUrl(fallback, options);
  }

  assertLiveKitConfigured(options: { requireWss?: boolean } = {}) {
    const apiKey = this.config.get<string>("LIVEKIT_API_KEY", "");
    const apiSecret = this.config.get<string>("LIVEKIT_API_SECRET", "");
    if (!apiKey?.trim() || !apiSecret?.trim()) {
      throw new LiveKitClientUrlError(
        LiveVideoErrorCode.LIVEKIT_CONFIG_UNAVAILABLE,
        "LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required",
      );
    }
    this.clientLivekitUrl(options);
  }

  mapConfigurationError(error: unknown): { code: string; message: string } {
    if (error instanceof LiveKitClientUrlError) {
      return { code: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      code: LiveVideoErrorCode.LIVEKIT_CONFIG_UNAVAILABLE,
      message,
    };
  }
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
