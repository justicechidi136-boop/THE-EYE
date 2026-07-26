#!/usr/bin/env node
/**
 * Split a combined Firebase google-services.json into app-specific payloads.
 * Usage:
 *   node scripts/ci/split-staging-google-services.cjs --source path --package com.theeye.app.staging
 */

const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`split-staging-google-services: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let source = null;
  let pkg = null;
  let expectedSha1 = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") source = argv[++i];
    else if (arg === "--package") pkg = argv[++i];
    else if (arg === "--expected-sha1") expectedSha1 = argv[++i].replace(/:/g, "").toLowerCase();
    else fail(`unknown argument: ${arg}`);
  }
  if (!source || !pkg) fail("provide --source and --package");
  return { source, pkg, expectedSha1 };
}

function main() {
  const { source, pkg, expectedSha1 } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(source)) fail(`source not found: ${source}`);

  const json = JSON.parse(fs.readFileSync(source, "utf8"));
  if (json.project_info?.project_id !== "the-eye-2stg") {
    fail(`project_id must be the-eye-2stg (got ${json.project_info?.project_id})`);
  }

  const client = (json.client ?? []).find(
    (entry) => entry.client_info?.android_client_info?.package_name === pkg,
  );
  if (!client) fail(`no client for package ${pkg}`);

  const androidOAuth = (client.oauth_client ?? []).find(
    (entry) => entry.client_type === 1 && entry.android_info?.package_name === pkg,
  );
  if (!androidOAuth) fail(`no Android OAuth client (type 1) for ${pkg}`);

  const cert = String(androidOAuth.android_info?.certificate_hash ?? "").toLowerCase();
  if (expectedSha1 && cert !== expectedSha1) {
    fail(`certificate_hash mismatch for ${pkg} (expected ${expectedSha1}, got ${cert || "missing"})`);
  }
  if (cert === "5da2e2ebfc7816b9c1fe780b102fd61f0c802ac7") {
    fail(`debug certificate_hash still present for ${pkg}`);
  }

  const split = {
    project_info: json.project_info,
    client: [client],
    configuration_version: json.configuration_version ?? "1",
  };

  process.stdout.write(JSON.stringify(split, null, 2));
}

main();
