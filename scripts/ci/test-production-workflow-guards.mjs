#!/usr/bin/env node
/**
 * Local scenario tests for production CI guard logic (A–E).
 * Does not print secret payloads — only presence/absence simulation.
 */
import {
  buildReadinessReport,
  validateProductionApiUrl,
  validateProductionGoogleServicesJson,
} from "./production-readiness-report.mjs";

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

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  process.exit(1);
}

console.log("\nAll production workflow guard scenarios passed.");
