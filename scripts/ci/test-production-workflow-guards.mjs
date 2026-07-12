#!/usr/bin/env node
/**
 * Local scenario tests for production CI guard logic (A–G).
 * Does not print secret payloads — only presence/absence simulation.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReadinessReport,
  STAGING_CANONICAL_API_URL,
  validateProductionApiUrl,
  validateProductionGoogleServicesJson,
  validateStagingApiUrl,
} from "./production-readiness-report.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const STAGING_MOBILE_JSON = JSON.stringify({
  project_info: { project_id: "the-eye-2stg" },
  client: [],
});

const PRODUCTION_MOBILE_JSON = JSON.stringify({
  project_info: { project_id: "the-eye-2pd-d0217" },
  client: [],
});

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed += 1;
  } else {
    console.error(`  FAIL: ${label}`);
    failed += 1;
  }
}

function scenario(name, fn) {
  console.log(`\nScenario ${name}`);
  fn();
}

scenario("A — No secrets", () => {
  const report = buildReadinessReport({
    mobileSecret: "",
    watchSecret: "",
    apiUrl: "",
    staticPassed: true,
    releaseBlocked: true,
  });

  assert(report.staticValidation === "PASS", "static validation PASS");
  assert(report.releaseArtifactVerification === "BLOCKED", "release artifact verification BLOCKED");
  assert(report.deploymentReadiness === "NO-GO", "deployment readiness NO-GO");
  assert(report.mobileFirebaseSecret === "MISSING", "mobile secret MISSING");
  assert(report.watchFirebaseSecret === "MISSING", "watch secret MISSING");
  assert(report.productionApiUrl === "MISSING", "API URL MISSING");

  const gateWouldFail =
    !validateProductionApiUrl("").ok ||
    !validateProductionGoogleServicesJson("").ok;
  assert(gateWouldFail, "release gate would fail closed");
});

scenario("B — Only API URL present", () => {
  const apiUrl = "https://api.theeye.com.ng";
  const report = buildReadinessReport({
    mobileSecret: "",
    watchSecret: "",
    apiUrl,
    staticPassed: true,
    releaseBlocked: true,
  });

  assert(report.staticValidation === "PASS", "static validation PASS");
  assert(report.releaseArtifactVerification === "BLOCKED", "release artifact verification BLOCKED");
  assert(report.deploymentReadiness === "NO-GO", "deployment readiness NO-GO");
  assert(report.productionApiUrl === "PRESENT", "API URL PRESENT");
  assert(report.mobileFirebaseSecret === "MISSING", "mobile secret still MISSING");
  assert(report.watchFirebaseSecret === "MISSING", "watch secret still MISSING");
});

scenario("C — All production values present", () => {
  const apiUrl = "https://api.theeye.com.ng";
  const report = buildReadinessReport({
    mobileSecret: PRODUCTION_MOBILE_JSON,
    watchSecret: PRODUCTION_MOBILE_JSON,
    apiUrl,
    staticPassed: true,
    releasePassed: true,
  });

  assert(report.releaseRequirementsMet, "release requirements met");
  assert(report.releaseArtifactVerification === "PASS", "release artifact verification PASS");
  assert(report.deploymentReadiness === "GO", "deployment readiness GO");
  assert(validateProductionApiUrl(apiUrl).ok, "API URL validates");
  assert(
    validateProductionGoogleServicesJson(PRODUCTION_MOBILE_JSON).ok,
    "production google-services JSON validates",
  );
});

scenario("D — Staging JSON posing as production", () => {
  const isolation = validateProductionGoogleServicesJson(STAGING_MOBILE_JSON);
  assert(!isolation.ok, "staging JSON rejected for production");
  assert(
    isolation.reason.includes("the-eye-2stg"),
    "rejection cites staging project id",
  );

  const report = buildReadinessReport({
    mobileSecret: STAGING_MOBILE_JSON,
    watchSecret: PRODUCTION_MOBILE_JSON,
    apiUrl: "https://api.theeye.com.ng",
    staticPassed: true,
    releaseBlocked: true,
  });
  assert(report.deploymentReadiness === "NO-GO", "deployment readiness NO-GO");
});

scenario("E — Placeholder/staging API URL rejected", () => {
  const badUrls = [
    "https://staging-api.theeye.com.ng",
    "https://localhost/api",
    "http://api.theeye.com.ng",
    "https://api.example.com",
    "https://ci-placeholder.theeye.com",
  ];

  for (const url of badUrls) {
    const result = validateProductionApiUrl(url);
    assert(!result.ok, `rejects ${url}`);
  }

  const ciCompile = validateProductionApiUrl(
    "https://production-ci-compile.theeye.internal",
    { allowCiCompileUrl: true },
  );
  assert(ciCompile.ok && ciCompile.ciCompileOnly, "allows CI static compile URL only in static mode");

  const realProd = validateProductionApiUrl("https://api.theeye.com.ng");
  assert(realProd.ok && !realProd.ciCompileOnly, "accepts real production API URL");
});

scenario("F — Staging API URL isolation", () => {
  const staging = validateStagingApiUrl(STAGING_CANONICAL_API_URL);
  assert(staging.ok, "accepts canonical staging API URL");

  const stagingWithPath = validateStagingApiUrl(`${STAGING_CANONICAL_API_URL}/v1`);
  assert(stagingWithPath.ok, "accepts staging API URL with path");

  const production = validateStagingApiUrl("https://api.theeye.com.ng");
  assert(!production.ok, "rejects production API host for staging");

  const localhost = validateStagingApiUrl("https://localhost:3000");
  assert(!localhost.ok, "rejects localhost for staging");
});

scenario("G — Staging API URL CLI wrapper", () => {
  const output = execSync(
    `node scripts/ci/validate-staging-api-url.mjs "${STAGING_CANONICAL_API_URL}"`,
    { encoding: "utf8" },
  ).trim();
  assert(output === STAGING_CANONICAL_API_URL, "CLI wrapper accepts canonical staging URL");
});

scenario("H — Production Job A mobile/watch manifest-only static steps", () => {
  const workflow = readFileSync(
    join(repoRoot, ".github/workflows/validate-production.yml"),
    "utf8",
  );

  assert(
    workflow.includes("Mobile static validation (manifest fallback)"),
    "workflow defines mobile static validation step",
  );
  assert(
    workflow.includes("Watch static validation (manifest fallback)"),
    "workflow defines watch static validation step",
  );
  assert(
    workflow.includes("flutter analyze lib test --no-fatal-infos --no-fatal-warnings"),
    "workflow uses non-fatal flutter analyze flags like staging",
  );
  assert(
    workflow.includes("node scripts/ci/validate-production-flutter-static.mjs --target mobile"),
    "mobile static step uses manifest-only validator",
  );
  assert(
    workflow.includes("node scripts/ci/validate-production-flutter-static.mjs --target watch"),
    "watch static step uses manifest-only validator",
  );

  const jobASection = workflow.split("production-release-gate:")[0];
  assert(
    !jobASection.includes("pnpm run test:mobile:firebase"),
    "Job A static validation does not require test:mobile:firebase",
  );
  assert(
    !jobASection.includes("pnpm run test:watch:firebase"),
    "Job A static validation does not require test:watch:firebase",
  );
});

scenario("I — Production flutter static manifest validator", () => {
  const output = execSync("node scripts/ci/validate-production-flutter-static.mjs --target both", {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert(output.includes("SECRET NOT PROVIDED: MOBILE_GOOGLE_SERVICES_JSON"), "logs mobile secret notice");
  assert(output.includes("SECRET NOT PROVIDED: WATCH_GOOGLE_SERVICES_JSON"), "logs watch secret notice");
  assert(output.includes("MANIFEST FALLBACK USED: mobile Firebase wiring"), "logs mobile manifest fallback");
  assert(output.includes("MANIFEST FALLBACK USED: watch Firebase wiring"), "logs watch manifest fallback");
  assert(output.includes("ARTIFACT BUILD NOT VERIFIED: mobile production APK"), "logs mobile artifact notice");
  assert(output.includes("ARTIFACT BUILD NOT VERIFIED: watch production APK"), "logs watch artifact notice");
  assert(output.includes("Placeholder apiKey accepted"), "accepts placeholder apiKeys");
  assert(output.includes('"status": "ok"'), "manifest validator returns ok");
});

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  process.exit(1);
}

console.log("\nAll production workflow guard scenarios passed.");
