import { createPublicKey, createVerify } from "crypto";

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CERT_CACHE_TTL_MS = 60 * 60 * 1000;

export type VerifiedFirebaseIdentity = {
  uid: string;
  provider: "google.com" | "apple.com";
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

type CachedCerts = {
  certs: Record<string, string>;
  fetchedAt: number;
};

let certCache: CachedCerts | null = null;

function decodeJwtPart(part: string): Record<string, unknown> {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

async function getFirebaseCerts(fetchImpl: typeof fetch = fetch): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now - certCache.fetchedAt < CERT_CACHE_TTL_MS) {
    return certCache.certs;
  }

  const response = await fetchImpl(FIREBASE_CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Unable to load Firebase signing certificates");
  const certs = (await response.json()) as Record<string, string>;
  certCache = { certs, fetchedAt: now };
  return certs;
}

export function resetFirebaseCertCacheForTests() {
  certCache = null;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedFirebaseIdentity> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase ID token format");

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJwtPart(headerB64);
  const payload = decodeJwtPart(payloadB64) as {
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    firebase?: { sign_in_provider?: string };
  };

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) throw new Error("Invalid Firebase token issuer");
  if (payload.aud !== projectId) throw new Error("Invalid Firebase token audience");
  if (!payload.sub) throw new Error("Missing Firebase UID");

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) throw new Error("Firebase token expired");
  if (!payload.iat || payload.iat > now + 60) throw new Error("Firebase token not yet valid");

  const kid = header.kid;
  if (typeof kid !== "string" || !kid) throw new Error("Missing Firebase token key id");

  const certs = await getFirebaseCerts(fetchImpl);
  const cert = certs[kid];
  if (!cert) throw new Error("Unknown Firebase signing key");

  const signedContent = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(
    signatureB64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (signatureB64.length % 4)) % 4),
    "base64",
  );
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signedContent);
  verifier.end();
  const publicKey = createPublicKey(cert);
  if (!verifier.verify(publicKey, signature)) throw new Error("Invalid Firebase token signature");

  const provider = payload.firebase?.sign_in_provider;
  if (provider !== "google.com" && provider !== "apple.com") {
    throw new Error("Unsupported Firebase auth provider");
  }

  return {
    uid: payload.sub,
    provider,
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
