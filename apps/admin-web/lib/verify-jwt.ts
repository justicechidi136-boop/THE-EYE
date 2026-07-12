import type { AdminSession } from "./types/admin-views";

function requireAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_ACCESS_SECRET is required for admin session verification");
  }
  return "dev-access-secret-32-chars-minimum!!";
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyHs256Signature(encodedHeader: string, encodedPayload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
  return bytesToBase64Url(signed) === signature;
}

export async function verifyAdminAccessToken(token: string): Promise<(AdminSession & { typ: "admin"; exp: number }) | null> {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedHeader))) as { alg?: string; typ?: string };
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
    if (!(await verifyHs256Signature(encodedHeader, encodedPayload, signature, requireAccessSecret()))) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as AdminSession & {
      typ?: string;
      exp?: number;
      sub?: string;
    };
    if (payload.typ !== "admin" || !payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as AdminSession & { typ: "admin"; exp: number };
  } catch {
    return null;
  }
}
