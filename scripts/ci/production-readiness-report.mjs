#!/usr/bin/env node
/**
 * Production CI readiness evaluation and GitHub Actions report output.
 *
 * Modes:
 *   static-report   — emit manifest-fallback notices (Job A)
 *   release-gate    — fail closed when release secrets/vars missing (Job B)
 *   deploy-gate     — fail closed for production deploy (Job C)
 *   summary         — full GO/NO-GO report from env inputs
 *   evaluate        — JSON evaluation only (used by tests)
 */
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

const PRODUCTION_PROJECT_ID = "the-eye-2pd-d0217";
const STAGING_PROJECT_IDS = ["the-eye-2stg", "the-eye-29cff"];
const CI_STATIC_COMPILE_API_URL = "https://production-ci-compile.theeye.internal";
export const STAGING_CANONICAL_API_URL = "https://staging-api.theeye.com.ng";
const PRODUCTION_API_HOST = "api.theeye.com.ng";

const FORBIDDEN_API_URL_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/i,
  /staging-api/i,
  /example\.com/i,
  /example\.test/i,
  /placeholder/i,
];

/** @param {string | undefined | null} value */
export function presence(value) {
  return value && String(value).trim() !== "" ? "PRESENT" : "MISSING";
}

/**
 * @param {string | undefined | null} url
 * @param {{ allowCiCompileUrl?: boolean }} [options]
 */
export function validateProductionApiUrl(url, options = {}) {
  const { allowCiCompileUrl = false } = options;
  const trimmed = String(url ?? "").trim();

  if (!trimmed) {
    return { ok: false, reason: "Production API URL is missing" };
  }

  if (!/^https:\/\//i.test(trimmed)) {
    return { ok: false, reason: "Production API URL must use HTTPS" };
  }

  if (allowCiCompileUrl && trimmed === CI_STATIC_COMPILE_API_URL) {
    return { ok: true, ciCompileOnly: true };
  }

  for (const pattern of FORBIDDEN_API_URL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, reason: `Production API URL rejected forbidden pattern: ${pattern}` };
    }
  }

  return { ok: true, ciCompileOnly: false };
}

/**
 * @param {string | undefined | null} url
 */
export function validateStagingApiUrl(url) {
  const trimmed = String(url ?? "").trim();

  if (!trimmed) {
    return { ok: false, reason: "Staging API URL is missing" };
  }

  if (!/^https:\/\//i.test(trimmed)) {
    return { ok: false, reason: "Staging API URL must use HTTPS" };
  }

  let host;
  try {
    host = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return { ok: false, reason: "Staging API URL is not a valid URL" };
  }

  if (host === "localhost" || host === "127.0.0.1") {
    return { ok: false, reason: "Staging API URL must not use localhost" };
  }

  if (host === PRODUCTION_API_HOST) {
    return {
      ok: false,
      reason: `Staging API URL must not use production API host (${PRODUCTION_API_HOST})`,
    };
  }

  return { ok: true };
}

/**
 * @param {string | undefined | null} jsonString
 * @param {{ flavor?: string }} [options]
 */
export function validateProductionGoogleServicesJson(jsonString, options = {}) {
  const { flavor = "production" } = options;
  const trimmed = String(jsonString ?? "").trim();

  if (!trimmed) {
    return { ok: false, reason: `${flavor} google-services.json payload is empty` };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: `${flavor} google-services.json is not valid JSON` };
  }

  const projectId = parsed?.project_info?.project_id ?? "";
  const serialized = JSON.stringify(parsed);

  for (const stagingId of STAGING_PROJECT_IDS) {
    if (projectId === stagingId || serialized.includes(stagingId)) {
      return {
        ok: false,
        reason: `Production google-services.json must not reference staging/development project ${stagingId}`,
      };
    }
  }

  if (flavor === "production" && projectId && projectId !== PRODUCTION_PROJECT_ID) {
    return {
      ok: false,
      reason: `Production google-services.json project_id must be ${PRODUCTION_PROJECT_ID} (got ${projectId})`,
    };
  }

  return { ok: true, projectId };
}

/**
 * @param {{
 *   mobileSecret?: string;
 *   watchSecret?: string;
 *   apiUrl?: string;
 *   staticPassed?: boolean;
 *   releasePassed?: boolean;
 *   releaseBlocked?: boolean;
 * }} input
 */
export function buildReadinessReport(input) {
  const mobile = presence(input.mobileSecret);
  const watch = presence(input.watchSecret);
  const apiUrl = presence(input.apiUrl);

  const apiValidation = validateProductionApiUrl(input.apiUrl);
  const releaseRequirementsMet =
    mobile === "PRESENT" && watch === "PRESENT" && apiUrl === "PRESENT" && apiValidation.ok;

  let releaseArtifactVerification = "BLOCKED";
  if (releaseRequirementsMet && input.releasePassed) {
    releaseArtifactVerification = "PASS";
  } else if (releaseRequirementsMet && input.releaseBlocked) {
    releaseArtifactVerification = "BLOCKED";
  } else if (!releaseRequirementsMet) {
    releaseArtifactVerification = "BLOCKED";
  }

  const staticValidation = input.staticPassed ? "PASS" : "FAIL";

  let deploymentReadiness = "NO-GO";
  if (
    staticValidation === "PASS" &&
    releaseArtifactVerification === "PASS" &&
    releaseRequirementsMet
  ) {
    deploymentReadiness = "GO";
  }

  return {
    mobileFirebaseSecret: mobile,
    watchFirebaseSecret: watch,
    productionApiUrl: apiUrl,
    staticValidation,
    releaseArtifactVerification,
    deploymentReadiness,
    releaseRequirementsMet,
    apiUrlValidation: apiValidation,
    ciStaticCompileApiUrl: CI_STATIC_COMPILE_API_URL,
  };
}

/** @param {ReturnType<typeof buildReadinessReport>} report */
export function formatReport(report) {
  return [
    "## Production readiness report",
    "",
    `| Check | Status |`,
    `|-------|--------|`,
    `| Mobile Firebase secret | ${report.mobileFirebaseSecret} |`,
    `| Watch Firebase secret | ${report.watchFirebaseSecret} |`,
    `| Production API URL | ${report.productionApiUrl} |`,
    `| Static validation | ${report.staticValidation} |`,
    `| Release artifact verification | ${report.releaseArtifactVerification} |`,
    `| Deployment readiness | ${report.deploymentReadiness} |`,
    "",
    report.mobileFirebaseSecret === "MISSING"
      ? "- SECRET NOT PROVIDED: MOBILE_GOOGLE_SERVICES_JSON"
      : null,
    report.watchFirebaseSecret === "MISSING"
      ? "- SECRET NOT PROVIDED: WATCH_GOOGLE_SERVICES_JSON"
      : null,
    report.productionApiUrl === "MISSING"
      ? "- SECRET NOT PROVIDED: NEXT_PUBLIC_API_BASE_URL (GitHub production environment var)"
      : null,
    report.mobileFirebaseSecret === "MISSING" || report.watchFirebaseSecret === "MISSING"
      ? "- MANIFEST FALLBACK USED: mobile/watch Firebase wiring validated from source manifest only"
      : null,
    report.releaseArtifactVerification === "BLOCKED"
      ? "- ARTIFACT BUILD NOT VERIFIED: release APK/Docker artifacts require all production secrets"
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

import { appendFileSync } from "node:fs";

function env(name) {
  return process.env[name] ?? "";
}

function runReleaseGate() {
  const mobile = env("MOBILE_GOOGLE_SERVICES_JSON");
  const watch = env("WATCH_GOOGLE_SERVICES_JSON");
  const apiUrl = env("NEXT_PUBLIC_API_BASE_URL");

  const errors = [];

  if (!mobile.trim()) {
    errors.push("MOBILE_GOOGLE_SERVICES_JSON is required for production release build");
  }
  if (!watch.trim()) {
    errors.push("WATCH_GOOGLE_SERVICES_JSON is required for production release build");
  }
  if (!apiUrl.trim()) {
    errors.push("NEXT_PUBLIC_API_BASE_URL is required for production release build");
  }

  const apiCheck = validateProductionApiUrl(apiUrl);
  if (!apiCheck.ok) {
    errors.push(apiCheck.reason);
  }

  const mobileCheck = validateProductionGoogleServicesJson(mobile);
  if (mobile.trim() && !mobileCheck.ok) {
    errors.push(mobileCheck.reason);
  }

  const watchCheck = validateProductionGoogleServicesJson(watch);
  if (watch.trim() && !watchCheck.ok) {
    errors.push(watchCheck.reason);
  }

  const report = buildReadinessReport({
    mobileSecret: mobile,
    watchSecret: watch,
    apiUrl,
    staticPassed: true,
    releaseBlocked: errors.length > 0,
  });

  console.log(formatReport(report));

  if (errors.length) {
    console.error("\nProduction release build blocked:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("\nProduction release gate passed — all required secrets and vars present.");
}

function runDeployGate() {
  const mobile = env("MOBILE_GOOGLE_SERVICES_JSON");
  const watch = env("WATCH_GOOGLE_SERVICES_JSON");
  const apiUrl = env("NEXT_PUBLIC_API_BASE_URL");
  const confirmRelease = env("CONFIRM_RELEASE_BUILD_PASSED");

  const errors = [];

  if (confirmRelease !== "true") {
    errors.push(
      "Production deploy requires confirm_release_build_passed=true (run after production-release-build succeeds)",
    );
  }
  if (!apiUrl.trim()) {
    errors.push("NEXT_PUBLIC_API_BASE_URL is required for production deploy");
  }

  const apiCheck = validateProductionApiUrl(apiUrl);
  if (!apiCheck.ok) {
    errors.push(apiCheck.reason);
  }

  if (!mobile.trim()) {
    errors.push("MOBILE_GOOGLE_SERVICES_JSON must be present before production deploy");
  }
  if (!watch.trim()) {
    errors.push("WATCH_GOOGLE_SERVICES_JSON must be present before production deploy");
  }

  if (errors.length) {
    console.error("Production deploy gate failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("Production deploy gate passed.");
}

function runStaticReport() {
  console.log("Production static validation — manifest fallback mode");
  console.log("SECRET NOT PROVIDED: MOBILE_GOOGLE_SERVICES_JSON (not required for static validation)");
  console.log("SECRET NOT PROVIDED: WATCH_GOOGLE_SERVICES_JSON (not required for static validation)");
  console.log("MANIFEST FALLBACK USED: mobile/watch Firebase wiring from auth-providers manifest");
  console.log("ARTIFACT BUILD NOT VERIFIED: mobile/watch production APK and deployable admin Docker image");
  console.log(`CI compile-only API URL: ${CI_STATIC_COMPILE_API_URL} (non-deploying, static validation only)`);
}

function runSummary() {
  const staticPassed = env("STATIC_VALIDATION_RESULT") === "success";
  const releaseResult = env("RELEASE_BUILD_RESULT");
  const releasePassed = releaseResult === "success";
  const releaseBlocked = releaseResult === "failure" || releaseResult === "skipped";

  const report = buildReadinessReport({
    mobileSecret: env("MOBILE_GOOGLE_SERVICES_JSON"),
    watchSecret: env("WATCH_GOOGLE_SERVICES_JSON"),
    apiUrl: env("NEXT_PUBLIC_API_BASE_URL"),
    staticPassed,
    releasePassed,
    releaseBlocked,
  });

  console.log(formatReport(report));

  if (process.env.GITHUB_OUTPUT) {
    const lines = [
      `mobile_firebase_secret=${report.mobileFirebaseSecret}`,
      `watch_firebase_secret=${report.watchFirebaseSecret}`,
      `production_api_url=${report.productionApiUrl}`,
      `static_validation=${report.staticValidation}`,
      `release_artifact_verification=${report.releaseArtifactVerification}`,
      `deployment_readiness=${report.deploymentReadiness}`,
    ];
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "evaluate" },
    },
  });

  switch (values.mode) {
    case "static-report":
      runStaticReport();
      break;
    case "release-gate":
      runReleaseGate();
      break;
    case "deploy-gate":
      runDeployGate();
      break;
    case "summary":
      runSummary();
      break;
    case "evaluate":
      console.log(JSON.stringify(buildReadinessReport({
        mobileSecret: env("MOBILE_GOOGLE_SERVICES_JSON"),
        watchSecret: env("WATCH_GOOGLE_SERVICES_JSON"),
        apiUrl: env("NEXT_PUBLIC_API_BASE_URL"),
        staticPassed: env("STATIC_PASSED") === "true",
        releasePassed: env("RELEASE_PASSED") === "true",
        releaseBlocked: env("RELEASE_BLOCKED") === "true",
      }), null, 2));
      break;
    default:
      console.error(`Unknown mode: ${values.mode}`);
      process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
