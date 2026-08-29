export type AndroidAssetLink = {
  relation: ["delegate_permission/common.handle_all_urls"];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function resolveAndroidAssetLinks(
  env: Record<string, string | undefined> = process.env,
): AndroidAssetLink[] {
  const appEnv = String(
    env.NEXT_PUBLIC_APP_ENV ?? env.THE_EYE_APP_ENV ?? env.NODE_ENV ?? "local",
  )
    .trim()
    .toLowerCase();
  const defaultPackage =
    appEnv === "production"
      ? "com.theeye.app"
      : appEnv === "staging"
        ? "com.theeye.app.staging"
        : "com.theeye.app.dev";
  const packageName =
    env.ANDROID_APP_LINK_PACKAGE?.trim() || defaultPackage;
  const fingerprints = Array.from(
    new Set(
      String(env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS ?? "")
        .split(/[\s,]+/)
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (fingerprints.some((value) => !SHA256_FINGERPRINT.test(value))) {
    throw new Error(
      "ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS contains an invalid SHA-256 certificate fingerprint",
    );
  }
  if ((appEnv === "staging" || appEnv === "production") && fingerprints.length === 0) {
    throw new Error(
      "ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS is required for deployable app-link verification",
    );
  }
  if (fingerprints.length === 0) return [];

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
