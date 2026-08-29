import { resolveAndroidAssetLinks } from "../android-app-links";

const fingerprint = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, "0"),
)
  .join(":")
  .toUpperCase();

describe("Android App Links", () => {
  it("serves the staging package with approved fingerprints", () => {
    const links = resolveAndroidAssetLinks({
      NEXT_PUBLIC_APP_ENV: "staging",
      ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS: fingerprint,
    });

    expect(links[0]?.target.package_name).toBe("com.theeye.app.staging");
    expect(links[0]?.target.sha256_cert_fingerprints).toEqual([fingerprint]);
  });

  it("fails closed when a deployable environment lacks fingerprints", () => {
    let message = "";
    try {
      resolveAndroidAssetLinks({ NEXT_PUBLIC_APP_ENV: "staging" });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("is required");
  });

  it("rejects malformed certificate fingerprints", () => {
    let message = "";
    try {
      resolveAndroidAssetLinks({
        NEXT_PUBLIC_APP_ENV: "production",
        ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS: "not-a-fingerprint",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("invalid SHA-256");
  });
});
