#!/usr/bin/env node
/**
 * Validates a staging release APK signing certificate.
 *
 * Usage:
 *   node scripts/validate-staging-apk-signing.cjs --apk path/to/app-staging-release.apk
 *   node scripts/validate-staging-apk-signing.cjs --apk path.apk --reject-debug
 *   node scripts/validate-staging-apk-signing.cjs --apk path.apk --expected-sha1 AB:CD:...
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ANDROID_DEBUG_SHA1 = "5da2e2ebfc7816b9c1fe780b102fd61f0c802ac7";
const ANDROID_DEBUG_SHA256 =
  "a6e66ccca4fa5d6217b789a2fd330625f411d24835fa6a65c8688f771d8032cb";

function fail(message) {
  console.error(`validate-staging-apk-signing: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { apk: null, rejectDebug: false, expectedSha1: null, expectedSha256: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apk") options.apk = argv[++i];
    else if (arg === "--reject-debug") options.rejectDebug = true;
    else if (arg === "--expected-sha1") options.expectedSha1 = normalizeSha(argv[++i]);
    else if (arg === "--expected-sha256") options.expectedSha256 = normalizeSha(argv[++i]);
    else fail(`unknown argument: ${arg}`);
  }
  if (!options.apk) fail("provide --apk <path>");
  return options;
}

function normalizeSha(value) {
  return String(value ?? "")
    .trim()
    .replace(/:/g, "")
    .toLowerCase();
}

function findApksigner() {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdkRoot || !fs.existsSync(sdkRoot)) return null;
  const buildTools = path.join(sdkRoot, "build-tools");
  if (!fs.existsSync(buildTools)) return null;
  const versions = fs
    .readdirSync(buildTools)
    .filter((name) => fs.existsSync(path.join(buildTools, name, "apksigner")))
    .sort()
    .reverse();
  if (!versions.length) return null;
  return path.join(buildTools, versions[0], "apksigner");
}

function extractFingerprints(apkPath) {
  const apksigner = findApksigner();
  if (apksigner) {
    const result = spawnSync(apksigner, ["verify", "--print-certs", apkPath], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      fail(`apksigner failed:\n${result.stdout}\n${result.stderr}`);
    }
    const text = `${result.stdout}\n${result.stderr}`;
    const sha1Match = text.match(/SHA-1 digest:\s*([a-f0-9]+)/i);
    const sha256Match = text.match(/SHA-256 digest:\s*([a-f0-9]+)/i);
    const subjectMatch = text.match(/certificate DN:\s*(.+)/i);
    if (!sha1Match || !sha256Match) {
      fail("unable to parse apksigner certificate output");
    }
    return {
      subject: subjectMatch?.[1]?.trim() ?? "unknown",
      sha1: sha1Match[1].toLowerCase(),
      sha256: sha256Match[1].toLowerCase(),
      tool: "apksigner",
    };
  }

  fail(
    "apksigner not found (set ANDROID_HOME/ANDROID_SDK_ROOT). Install Android build-tools to validate APK signing.",
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.apk)) {
    fail(`APK not found: ${options.apk}`);
  }

  const cert = extractFingerprints(options.apk);
  console.log(`validate-staging-apk-signing: subject=${cert.subject}`);
  console.log(`validate-staging-apk-signing: sha1=${cert.sha1}`);
  console.log(`validate-staging-apk-signing: sha256=${cert.sha256}`);

  if (options.rejectDebug) {
    if (cert.sha1 === ANDROID_DEBUG_SHA1 || cert.sha256 === ANDROID_DEBUG_SHA256) {
      fail(
        "staging release APK is signed with the Android debug certificate — configure dedicated staging signing",
      );
    }
  }

  if (options.expectedSha1 && cert.sha1 !== options.expectedSha1) {
    fail(`SHA-1 mismatch (expected ${options.expectedSha1}, got ${cert.sha1})`);
  }
  if (options.expectedSha256 && cert.sha256 !== options.expectedSha256) {
    fail(`SHA-256 mismatch (expected ${options.expectedSha256}, got ${cert.sha256})`);
  }

  console.log("validate-staging-apk-signing: passed");
}

main();
