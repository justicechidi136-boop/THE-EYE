import { createHmac, timingSafeEqual } from "crypto";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function parseTtl(ttl: string | undefined, fallbackSeconds: number): number {
  if (!ttl) return fallbackSeconds;
  const match = /^(\d+)([smhd])?$/.exec(ttl);
  if (!match) return fallbackSeconds;
  const value = Number(match[1]);
  const unit = match[2] ?? "s";
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

export type JwtPayload = {
  sub: string;
  typ: "user" | "admin";
  jti?: string;
  email?: string;
  phone?: string;
  role?: string;
  permissions?: string[];
  country?: string;
  state?: string;
  lga?: string;
  agencyId?: string;
  jurisdictionId?: string;
};

export function signJwt(payload: JwtPayload, secret: string, ttl: string | undefined): string {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + parseTtl(ttl, 900) };
  const encodedHeader = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify(body));
  const signature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload & { exp: number; iat: number } {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) throw new Error("Invalid token");

  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  if (header.alg !== "HS256" || header.typ !== "JWT") throw new Error("Unsupported token header");

  const expected = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (!payload.sub || !["user", "admin"].includes(payload.typ) || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    throw new Error("Invalid token payload");
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return payload;
}
