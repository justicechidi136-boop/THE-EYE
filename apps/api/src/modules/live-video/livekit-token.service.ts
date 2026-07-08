import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID } from "crypto";

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

  createToken(input: { identity: string; name: string; roomName: string; canPublish: boolean; canSubscribe: boolean; lowBandwidthMode?: boolean }) {
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
      metadata: JSON.stringify({ lowBandwidthMode: input.lowBandwidthMode ?? false }),
    };
    return signJwt(payload, apiSecret);
  }

  livekitUrl() {
    return this.config.get<string>("LIVEKIT_URL", "wss://livekit.local");
  }
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
