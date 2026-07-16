import { createSign, generateKeyPairSync } from "crypto";
import { peekFirebaseIdToken, resetFirebaseCertCacheForTests, verifyFirebaseIdToken } from "../firebase-id-token";
import {
  DEVELOPMENT_FIREBASE_PROJECT_ID,
  PRODUCTION_FIREBASE_PROJECT_ID,
  STAGING_FIREBASE_PROJECT_ID,
} from "../firebase-project";

const kid = "test-key";

function signTestToken(payload: Record<string, unknown>, privateKey: string) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const content = `${header}.${body}`;
  const sign = createSign("RSA-SHA256");
  sign.update(content);
  sign.end();
  const signature = sign.sign(privateKey).toString("base64url");
  return `${content}.${signature}`;
}

describe("verifyFirebaseIdToken", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("accepts a valid Google Firebase token for production", async () => {
    resetFirebaseCertCacheForTests();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [kid]: publicPem }),
    });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${PRODUCTION_FIREBASE_PROJECT_ID}`,
        aud: PRODUCTION_FIREBASE_PROJECT_ID,
        sub: "firebase-google-uid",
        exp: now + 3600,
        iat: now,
        email: "citizen@theeye.local",
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    const identity = await verifyFirebaseIdToken(token, PRODUCTION_FIREBASE_PROJECT_ID, fetchMock as never);
    expect(identity.uid).toBe("firebase-google-uid");
    expect(identity.provider).toBe("google.com");
    expect(identity.email).toBe("citizen@theeye.local");
  });

  it("accepts a valid Google Firebase token for staging", async () => {
    resetFirebaseCertCacheForTests();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [kid]: publicPem }),
    });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${STAGING_FIREBASE_PROJECT_ID}`,
        aud: STAGING_FIREBASE_PROJECT_ID,
        sub: "firebase-stg-uid",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    const identity = await verifyFirebaseIdToken(token, STAGING_FIREBASE_PROJECT_ID, fetchMock as never);
    expect(identity.uid).toBe("firebase-stg-uid");
    expect(identity.provider).toBe("google.com");
  });

  it("accepts a valid Google Firebase token for development", async () => {
    resetFirebaseCertCacheForTests();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [kid]: publicPem }),
    });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${DEVELOPMENT_FIREBASE_PROJECT_ID}`,
        aud: DEVELOPMENT_FIREBASE_PROJECT_ID,
        sub: "firebase-dev-uid",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    const identity = await verifyFirebaseIdToken(token, DEVELOPMENT_FIREBASE_PROJECT_ID, fetchMock as never);
    expect(identity.uid).toBe("firebase-dev-uid");
  });

  it("rejects an expired Firebase token", async () => {
    resetFirebaseCertCacheForTests();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [kid]: publicPem }),
    });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${PRODUCTION_FIREBASE_PROJECT_ID}`,
        aud: PRODUCTION_FIREBASE_PROJECT_ID,
        sub: "firebase-expired",
        exp: now - 10,
        iat: now - 20,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    try {
      await verifyFirebaseIdToken(token, PRODUCTION_FIREBASE_PROJECT_ID, fetchMock as never);
      throw new Error("Expected expired token failure");
    } catch (error) {
      expect(String((error as Error).message)).toContain("expired");
    }
  });

  it("rejects the wrong Firebase project audience", async () => {
    resetFirebaseCertCacheForTests();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [kid]: publicPem }),
    });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: "https://securetoken.google.com/other-project",
        aud: "other-project",
        sub: "firebase-wrong-project",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "apple.com" },
      },
      privatePem,
    );

    try {
      await verifyFirebaseIdToken(token, PRODUCTION_FIREBASE_PROJECT_ID, fetchMock as never);
      throw new Error("Expected audience failure");
    } catch (error) {
      expect(String((error as Error).message)).toContain("issuer");
    }
  });

  it("rejects a staging token verified against the production project", async () => {
    resetFirebaseCertCacheForTests();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [kid]: publicPem }),
    });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${STAGING_FIREBASE_PROJECT_ID}`,
        aud: STAGING_FIREBASE_PROJECT_ID,
        sub: "firebase-stg-uid",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    try {
      await verifyFirebaseIdToken(token, PRODUCTION_FIREBASE_PROJECT_ID, fetchMock as never);
      throw new Error("Expected cross-environment rejection");
    } catch (error) {
      expect(String((error as Error).message)).toContain("issuer");
    }
  });
});

describe("peekFirebaseIdToken", () => {
  it("returns aud, iss, and provider without verifying signature", () => {
    const payload = Buffer.from(
      JSON.stringify({
        aud: STAGING_FIREBASE_PROJECT_ID,
        iss: `https://securetoken.google.com/${STAGING_FIREBASE_PROJECT_ID}`,
        firebase: { sign_in_provider: "google.com" },
      }),
    ).toString("base64url");
    const token = `header.${payload}.signature`;

    expect(peekFirebaseIdToken(token)).toEqual({
      aud: STAGING_FIREBASE_PROJECT_ID,
      iss: `https://securetoken.google.com/${STAGING_FIREBASE_PROJECT_ID}`,
      provider: "google.com",
    });
  });

  it("returns null for malformed tokens", () => {
    expect(peekFirebaseIdToken("not-a-jwt")).toEqual(null);
  });
});
