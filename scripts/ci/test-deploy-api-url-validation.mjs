#!/usr/bin/env node
import {
  CI_STATIC_COMPILE_API_URL,
  DEPLOY_URL_ERROR,
  STAGING_CANONICAL_API_URL,
  validateProductionApiUrl,
  validateStagingApiUrl,
} from "./deploy-api-url-validation.mjs";

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

function expectPass(url, validator, label) {
  const result = validator(url);
  assert(result.ok, `${label} accepts ${url}`);
}

function expectFail(url, validator, code, label) {
  const result = validator(url);
  assert(!result.ok, `${label} rejects ${url}`);
  if (!result.ok && code) {
    assert(result.code === code, `${label} returns ${code} for ${url}`);
  }
}

console.log("\nStaging deploy URL validation");

for (const url of [
  "https://staging-api.theeye.com.ng/v1",
  "https://staging-api.theeye.com.ng/v1/",
]) {
  expectPass(url, validateStagingApiUrl, "staging canonical");
}

for (const [url, code] of [
  ["http://staging-api.theeye.com.ng/v1", DEPLOY_URL_ERROR.PROTOCOL],
  ["https://staging-api.theeye.com.ng", DEPLOY_URL_ERROR.PATH],
  ["https://staging-api.theeye.com.ng/v2", DEPLOY_URL_ERROR.PATH],
  ["https://staging-dashboard8jps.theeye.com.ng/v1", DEPLOY_URL_ERROR.HOSTNAME],
  ["https://api.theeye.com.ng/v1", DEPLOY_URL_ERROR.HOSTNAME],
  ["https://www.theeye.com.ng/v1", DEPLOY_URL_ERROR.HOSTNAME],
  ["http://localhost:4000/v1", DEPLOY_URL_ERROR.PROTOCOL],
  ["http://127.0.0.1:4000/v1", DEPLOY_URL_ERROR.PROTOCOL],
  ["", DEPLOY_URL_ERROR.MALFORMED],
  ["not-a-url", DEPLOY_URL_ERROR.MALFORMED],
  ["https://user:pass@staging-api.theeye.com.ng/v1", DEPLOY_URL_ERROR.CREDENTIALS],
  ["https://staging-api.theeye.com.ng:8443/v1", DEPLOY_URL_ERROR.PORT],
  ["https://evil-staging-api.theeye.com.ng/v1", DEPLOY_URL_ERROR.HOSTNAME],
  ["https://staging-api.theeye.com.ng.evil.example/v1", DEPLOY_URL_ERROR.HOSTNAME],
]) {
  expectFail(url, validateStagingApiUrl, code, "staging isolation");
}

console.log("\nProduction deploy URL validation");

expectPass("https://api.theeye.com.ng/v1", validateProductionApiUrl, "production canonical");
expectPass("https://api.theeye.com.ng/v1/", validateProductionApiUrl, "production canonical trailing slash");

for (const [url, code] of [
  ["https://staging-api.theeye.com.ng/v1", DEPLOY_URL_ERROR.HOSTNAME],
  ["http://api.theeye.com.ng/v1", DEPLOY_URL_ERROR.PROTOCOL],
  ["https://api.theeye.com.ng", DEPLOY_URL_ERROR.PATH],
  ["https://localhost/v1", DEPLOY_URL_ERROR.HOSTNAME],
]) {
  expectFail(url, validateProductionApiUrl, code, "production isolation");
}

const ciCompile = validateProductionApiUrl(CI_STATIC_COMPILE_API_URL, { allowCiCompileUrl: true });
assert(ciCompile.ok && ciCompile.ciCompileOnly, "allows CI compile-only production URL");

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) process.exit(1);

console.log("\nAll deploy API URL guard tests passed.");
