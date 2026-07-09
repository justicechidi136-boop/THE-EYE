import { signJwt, verifyJwt } from "../jwt";
import { validateEnvironment } from "../../../config/validate-env";

describe("authentication security", () => {
  it("rejects a JWT with an unsupported algorithm header", () => {
    const token = signJwt({ sub: "user-1", typ: "user" }, "test-secret", "15m");
    const [, payload, signature] = token.split(".");
    const badHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(() => verifyJwt(`${badHeader}.${payload}.${signature}`, "test-secret")).toThrow();
  });

  it("requires strong production secrets and trusted origins", () => {
    expect(() => validateEnvironment({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "dev-access-secret",
    })).toThrow();
  });

  it("accepts a complete production security configuration", () => {
    const config = {
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      LIVE_LOCATION_LINK_SECRET: "c".repeat(32),
      LIVEKIT_API_KEY: "d".repeat(24),
      LIVEKIT_API_SECRET: "e".repeat(32),
      S3_SECRET_KEY: "f".repeat(32),
      REDIS_PASSWORD: "g".repeat(32),
      CORS_ORIGINS: "https://admin.theeye.example",
      GOOGLE_OAUTH_CLIENT_ID: "client.apps.googleusercontent.com",
      DATABASE_URL: "postgresql://example",
      S3_ENDPOINT: "https://s3.example.com",
      S3_BUCKET: "the-eye",
      S3_ACCESS_KEY: "access-key",
    };
    expect(validateEnvironment(config)).toBe(config);
  });
});
