#!/usr/bin/env node
/**
 * Validates Firebase auth provider wiring for staging and production:
 * - Dart firebase_options_* IDs match scripts/firebase/auth-providers.manifest.json
 * - No cross-environment project ID leakage in staging/production config files
 * - Production google-services.json.example OAuth clients align with manifest
 *
 * Does NOT require gitignored google-services.json (use pnpm run test:mobile:firebase for that).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(__dirname, "firebase", "auth-providers.manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const failures = [];
const warnings = [];

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function parseDartFirebaseOptions(relativePath) {
  const source = readFile(relativePath);
  const pick = (pattern) => {
    const match = source.match(pattern);
    return match?.[1] ?? match?.[2] ?? null;
  };
  return {
    source,
    projectId: pick(/projectId:\s*['"]([^'"]+)['"]/),
    appId: pick(/appId:\s*['"]([^'"]+)['"]/),
    messagingSenderId: pick(/messagingSenderId:\s*['"]([^'"]+)['"]/),
    webClientId: pick(/androidGoogleWebClientId\s*=\s*['"]([^'"]+)['"]/),
    iosBundleId: pick(/iosBundleId:\s*['"]([^'"]+)['"]/),
  };
}

function readGoogleServicesExample(relativePath) {
  if (!fileExists(relativePath)) return null;
  return JSON.parse(readFile(relativePath));
}

function oauthClientsFromGoogleServices(json, packageName) {
  if (!json) return null;
  const client =
    json.client?.find(
      (entry) =>
        entry?.client_info?.android_client_info?.package_name === packageName,
    ) ?? json.client?.[0];
  const oauth = client?.oauth_client ?? [];
  return {
    webClientId: oauth.find((entry) => entry.client_type === 3)?.client_id ?? null,
    androidClientId: oauth.find((entry) => entry.client_type === 1)?.client_id ?? null,
    certificateHash:
      oauth.find((entry) => entry.client_type === 1)?.android_info?.certificate_hash ??
      null,
    appId: client?.client_info?.mobilesdk_app_id ?? null,
    projectId: json.project_info?.project_id ?? null,
  };
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: expected "${expected}", got "${actual ?? "<missing>"}"`);
  }
}

function assertNotContains(label, source, forbidden) {
  for (const token of forbidden) {
    if (source.includes(token)) {
      failures.push(`${label} must not reference ${token}`);
    }
  }
}

for (const env of ["staging", "production"]) {
  const cfg = manifest.environments[env];
  const forbidden =
    env === "staging"
      ? manifest.forbiddenCrossReferences.stagingMustNotContain
      : manifest.forbiddenCrossReferences.productionMustNotContain;

  const mobileDartPath = `apps/mobile/lib/firebase_options_${env}.dart`;
  const watchDartPath = `apps/watch/lib/firebase_options_${env}.dart`;
  const mobileDart = parseDartFirebaseOptions(mobileDartPath);
  const watchDart = parseDartFirebaseOptions(watchDartPath);

  assertEqual(`${env} mobile projectId`, mobileDart.projectId, cfg.firebaseProjectId);
  assertEqual(`${env} mobile android appId`, mobileDart.appId, cfg.apps.mobile.androidAppId);
  assertEqual(
    `${env} mobile messagingSenderId`,
    mobileDart.messagingSenderId,
    cfg.gcpProjectNumber,
  );
  assertEqual(
    `${env} mobile web OAuth client`,
    mobileDart.webClientId,
    cfg.apps.mobile.webOAuthClientId,
  );
  assertEqual(`${env} mobile ios bundle`, mobileDart.iosBundleId, cfg.apps.mobile.iosBundleId);

  assertEqual(`${env} watch projectId`, watchDart.projectId, cfg.firebaseProjectId);
  assertEqual(`${env} watch android appId`, watchDart.appId, cfg.apps.watch.androidAppId);
  assertEqual(
    `${env} watch messagingSenderId`,
    watchDart.messagingSenderId,
    cfg.gcpProjectNumber,
  );

  assertNotContains(`${env} mobile dart`, mobileDart.source, forbidden);
  assertNotContains(`${env} watch dart`, watchDart.source, forbidden);

  const mobileExamplePath = `apps/mobile/android/app/src/${env}/google-services.json.example`;
  const mobileExample = readGoogleServicesExample(mobileExamplePath);
  if (mobileExample) {
    const oauth = oauthClientsFromGoogleServices(
      mobileExample,
      cfg.apps.mobile.androidPackage,
    );
    if (oauth?.webClientId) {
      assertEqual(
        `${env} mobile google-services.example web OAuth`,
        oauth.webClientId,
        cfg.apps.mobile.webOAuthClientId,
      );
    }
    if (oauth?.androidClientId && cfg.apps.mobile.androidOAuthClientId) {
      assertEqual(
        `${env} mobile google-services.example android OAuth`,
        oauth.androidClientId,
        cfg.apps.mobile.androidOAuthClientId,
      );
    }
    if (oauth?.appId && !oauth.appId.startsWith("REPLACE_")) {
      assertEqual(`${env} mobile google-services.example appId`, oauth.appId, cfg.apps.mobile.androidAppId);
    }
  } else {
    warnings.push(`missing ${mobileExamplePath}`);
  }

  const googleServicesPath = `apps/mobile/android/app/src/${env}/google-services.json`;
  if (!fileExists(googleServicesPath)) {
    warnings.push(
      `missing gitignored ${googleServicesPath} — download from Firebase Console after fingerprint registration`,
    );
  }
}

const verifierSource = readFile("apps/api/src/common/auth/firebase-auth.verifier.ts");
if (verifierSource.includes('projectId !== "the-eye-2pd-d0217"')) {
  warnings.push(
    "API FirebaseAuthVerifier still hard-rejects non-production FIREBASE_PROJECT_ID values.",
  );
}
if (!fileExists("apps/api/src/common/auth/firebase-project.ts")) {
  warnings.push("missing apps/api/src/common/auth/firebase-project.ts for per-environment Firebase project resolution");
}

let debugFingerprints = null;
try {
  const home = process.env.USERPROFILE || process.env.HOME;
  const debugKeystore = home ? path.join(home, ".android", "debug.keystore") : null;
  if (debugKeystore && fs.existsSync(debugKeystore)) {
    const keytoolCandidates = [
      process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, "bin", "keytool.exe"),
      "C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe",
      "keytool",
    ].filter(Boolean);
    for (const keytool of keytoolCandidates) {
      try {
        const output = execSync(
          `"${keytool}" -list -v -keystore "${debugKeystore}" -alias androiddebugkey -storepass android -keypass android`,
          { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
        );
        const sha1 = output.match(/SHA1:\s*(.+)/)?.[1]?.trim();
        const sha256 = output.match(/SHA256:\s*(.+)/)?.[1]?.trim();
        if (sha1 && sha256) {
          debugFingerprints = { sha1, sha256 };
          if (sha1.toUpperCase() !== manifest.androidDebugFingerprints.sha1.toUpperCase()) {
            warnings.push(
              `Local debug SHA-1 (${sha1}) differs from manifest (${manifest.androidDebugFingerprints.sha1}). Update manifest if this machine is canonical.`,
            );
          }
        }
        break;
      } catch {
        // try next keytool path
      }
    }
  }
} catch {
  // optional probe
}

if (failures.length) {
  console.error("Firebase auth provider validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const report = {
  status: "ok",
  manifestVersion: manifest.version,
  environments: Object.fromEntries(
    Object.entries(manifest.environments).map(([env, cfg]) => [
      env,
      {
        firebaseProjectId: cfg.firebaseProjectId,
        mobilePackage: cfg.apps.mobile.androidPackage,
        watchPackage: cfg.apps.watch.androidPackage,
        webOAuthClientId: cfg.apps.mobile.webOAuthClientId,
      },
    ]),
  ),
  debugFingerprints: debugFingerprints ?? manifest.androidDebugFingerprints,
  warnings,
};

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log(JSON.stringify(report, null, 2));
