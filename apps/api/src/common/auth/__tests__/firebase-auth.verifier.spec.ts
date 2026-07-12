import { createSign, generateKeyPairSync } from "crypto";
import { ConfigService } from "@nestjs/config";
import { FirebaseAuthVerifier } from "../firebase-auth.verifier";
import { resetFirebaseCertCacheForTests } from "../firebase-id-token";
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

function createVerifier(env: Record<string, string>) {
  const config = {
    get: (key: string, fallback?: string) => env[key] ?? fallback,
  } as ConfigService;
  return new FirebaseAuthVerifier(config);
}

describe("FirebaseAuthVerifier", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  function mockFetch() {
    return jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ [kid]: publicPem }),
    }) as never;
  }

  it("accepts a valid token for the staging Firebase project", async () => {
    resetFirebaseCertCacheForTests();
    global.fetch = mockFetch();
    const verifier = createVerifier({ FIREBASE_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${STAGING_FIREBASE_PROJECT_ID}`,
        aud: STAGING_FIREBASE_PROJECT_ID,
        sub: "firebase-uid",
        exp: now + 3600,
        iat: now,
        email: "citizen@theeye.local",
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    const identity = await verifier.verify(token, "google.com");
    expect(identity.uid).toBe("firebase-uid");
    expect(identity.provider).toBe("google.com");
  });

  it("accepts a valid token for the production Firebase project", async () => {
    resetFirebaseCertCacheForTests();
    global.fetch = mockFetch();
    const verifier = createVerifier({ FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${PRODUCTION_FIREBASE_PROJECT_ID}`,
        aud: PRODUCTION_FIREBASE_PROJECT_ID,
        sub: "firebase-uid",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    const identity = await verifier.verify(token, "google.com");
    expect(identity.uid).toBe("firebase-uid");
  });

  it("accepts a valid token for the development Firebase project", async () => {
    resetFirebaseCertCacheForTests();
    global.fetch = mockFetch();
    const verifier = createVerifier({ FIREBASE_PROJECT_ID: DEVELOPMENT_FIREBASE_PROJECT_ID });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${DEVELOPMENT_FIREBASE_PROJECT_ID}`,
        aud: DEVELOPMENT_FIREBASE_PROJECT_ID,
        sub: "firebase-uid",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    const identity = await verifier.verify(token, "google.com");
    expect(identity.uid).toBe("firebase-uid");
  });

  it("rejects a production token when API is configured for staging", async () => {
    resetFirebaseCertCacheForTests();
    global.fetch = mockFetch();
    const verifier = createVerifier({ FIREBASE_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${PRODUCTION_FIREBASE_PROJECT_ID}`,
        aud: PRODUCTION_FIREBASE_PROJECT_ID,
        sub: "firebase-prod-uid",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "google.com" },
      },
      privatePem,
    );

    try {
      await verifier.verify(token, "google.com");
      throw new Error("Expected cross-environment rejection");
    } catch (error) {
      expect(String((error as Error).message)).toContain("issuer");
    }
  });

  it("rejects a staging token when API is configured for production", async () => {
    resetFirebaseCertCacheForTests();
    global.fetch = mockFetch();
    const verifier = createVerifier({ FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID });
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
      await verifier.verify(token, "google.com");
      throw new Error("Expected cross-environment rejection");
    } catch (error) {
      expect(String((error as Error).message)).toContain("issuer");
    }
  });

  it("resolves project ID from FCM_PROJECT_ID when FIREBASE_PROJECT_ID is unset", async () => {
    resetFirebaseCertCacheForTests();
    global.fetch = mockFetch();
    const verifier = createVerifier({ FCM_PROJECT_ID: STAGING_FIREBASE_PROJECT_ID });
    const now = Math.floor(Date.now() / 1000);
    const token = signTestToken(
      {
        iss: `https://securetoken.google.com/${STAGING_FIREBASE_PROJECT_ID}`,
        aud: STAGING_FIREBASE_PROJECT_ID,
        sub: "firebase-stg-uid",
        exp: now + 3600,
        iat: now,
        firebase: { sign_in_provider: "apple.com" },
      },
      privatePem,
    );

    const identity = await verifier.verify(token, "apple.com");
    expect(identity.provider).toBe("apple.com");
  });

  it("rejects unknown FIREBASE_PROJECT_ID values", async () => {
    const verifier = createVerifier({ FIREBASE_PROJECT_ID: "other-project" });
    try {
      await verifier.verify("token", "google.com");
      throw new Error("Expected unknown project rejection");
    } catch (error) {
      expect(String((error as Error).message)).toContain("FIREBASE_PROJECT_ID");
    }
  });
});
