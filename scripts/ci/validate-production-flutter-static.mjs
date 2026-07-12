#!/usr/bin/env node
/**
 * Production Job A — manifest-only mobile/watch Firebase wiring.
 * Does NOT require gitignored google-services.json or real apiKey values.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = join(repoRoot, "scripts/firebase/auth-providers.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const production = manifest.environments.production;

const TARGETS = {
  mobile: {
    secretName: "MOBILE_GOOGLE_SERVICES_JSON",
    artifactLabel: "mobile production APK",
    gradlePath: "apps/mobile/android/app/build.gradle",
    firebaseOptionsPath: "apps/mobile/lib/firebase_options_production.dart",
    expectedPackage: production.apps.mobile.androidPackage,
    expectedProjectId: production.firebaseProjectId,
    expectedAppId: production.apps.mobile.androidAppId,
  },
  watch: {
    secretName: "WATCH_GOOGLE_SERVICES_JSON",
    artifactLabel: "watch production APK",
    gradlePath: "apps/watch/android/app/build.gradle.kts",
    firebaseOptionsPath: "apps/watch/lib/firebase_options_production.dart",
    expectedPackage: production.apps.watch.androidPackage,
    expectedProjectId: production.firebaseProjectId,
    expectedAppId: production.apps.watch.androidAppId,
  },
};

const { values } = parseArgs({
  options: {
    target: { type: "string", default: "both" },
  },
});

function readRepoFile(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function pickDartString(source, field) {
  const match = source.match(new RegExp(`${field}:\\s*['"]([^'"]+)['"]`));
  return match?.[1] ?? null;
}

function validateTarget(name) {
  const cfg = TARGETS[name];
  if (!cfg) {
    console.error(`Unknown target: ${name}`);
    process.exit(1);
  }

  console.log(`SECRET NOT PROVIDED: ${cfg.secretName}`);
  console.log(`MANIFEST FALLBACK USED: ${name} Firebase wiring`);
  console.log(`ARTIFACT BUILD NOT VERIFIED: ${cfg.artifactLabel}`);

  const gradle = readRepoFile(cfg.gradlePath);
  if (!gradle.includes(cfg.expectedPackage)) {
    console.error(
      `Package ID check failed: ${cfg.gradlePath} must reference ${cfg.expectedPackage}`,
    );
    process.exit(1);
  }
  console.log(`Package ID verified: ${cfg.expectedPackage}`);

  const dartSource = readRepoFile(cfg.firebaseOptionsPath);
  const projectId = pickDartString(dartSource, "projectId");
  const appId = pickDartString(dartSource, "appId");

  if (projectId !== cfg.expectedProjectId) {
    console.error(
      `Production manifest projectId mismatch in ${cfg.firebaseOptionsPath}: expected ${cfg.expectedProjectId}, got ${projectId ?? "<missing>"}`,
    );
    process.exit(1);
  }
  if (appId !== cfg.expectedAppId) {
    console.error(
      `Production manifest appId mismatch in ${cfg.firebaseOptionsPath}: expected ${cfg.expectedAppId}, got ${appId ?? "<missing>"}`,
    );
    process.exit(1);
  }

  if (/REPLACE_WITH_/.test(dartSource)) {
    console.log(
      `Placeholder apiKey accepted in ${cfg.firebaseOptionsPath} (manifest-only static validation)`,
    );
  }

  console.log(`Production manifest project ID verified: ${cfg.expectedProjectId}`);
}

function runAuthProviders() {
  execSync("node scripts/validate-firebase-auth-providers.cjs", {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

const target = values.target ?? "both";
const selected =
  target === "both" ? ["mobile", "watch"] : [target];

for (const name of selected) {
  validateTarget(name);
}

runAuthProviders();

console.log(
  JSON.stringify(
    {
      status: "ok",
      mode: "manifest-only",
      targets: selected,
      productionProjectId: production.firebaseProjectId,
    },
    null,
    2,
  ),
);
