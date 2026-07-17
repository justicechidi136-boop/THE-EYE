#!/usr/bin/env node
/**
 * Validates built staging artifacts embed the canonical API URL and exclude forbidden hosts.
 *
 * Usage:
 *   node scripts/validate-staging-artifacts.cjs --admin-next apps/admin-web/.next
 *   node scripts/validate-staging-artifacts.cjs --mobile-apk path/to/app-staging.apk
 *   node scripts/validate-staging-artifacts.cjs --watch-apk path/to/watch-staging.apk
 *   node scripts/validate-staging-artifacts.cjs --admin-next .next --mobile-apk app.apk --watch-apk watch.apk
 */

const fs = require("fs");
const path = require("path");

const CANONICAL_API_URL = "https://staging-api.theeye.com.ng/v1";

const FORBIDDEN_MARKERS = [
  "https://staging-dashboard8jps.theeye.com.ng/v1",
  "https://api.theeye.com.ng",
  "localhost",
  "127.0.0.1",
];

const TEXT_EXTENSIONS = /\.(js|json|html|txt|map|css|xml|dart)$/i;

function fail(message) {
  console.error(`validate-staging-artifacts: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    adminNext: null,
    mobileApk: null,
    watchApk: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--admin-next") {
      options.adminNext = argv[++i];
    } else if (arg === "--mobile-apk") {
      options.mobileApk = argv[++i];
    } else if (arg === "--watch-apk") {
      options.watchApk = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/validate-staging-artifacts.cjs [options]

Options:
  --admin-next <dir>   Admin Next.js build output (.next directory)
  --mobile-apk <path>  Mobile staging APK or AAB
  --watch-apk <path>   Watch staging APK

Requires at least one artifact path.`);
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  if (!options.adminNext && !options.mobileApk && !options.watchApk) {
    fail("provide at least one of --admin-next, --mobile-apk, or --watch-apk");
  }

  return options;
}

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (TEXT_EXTENSIONS.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function readSearchableContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".apk" || ext === ".aab") {
    return fs.readFileSync(filePath);
  }
  return fs.readFileSync(filePath, "utf8");
}

function contentIncludes(content, needle) {
  if (Buffer.isBuffer(content)) {
    return content.includes(Buffer.from(needle, "utf8"));
  }
  return content.includes(needle);
}

function collectTargets(options) {
  const targets = [];

  if (options.adminNext) {
    if (!fs.existsSync(options.adminNext)) {
      fail(`admin-next directory not found: ${options.adminNext}`);
    }
    for (const file of walkFiles(options.adminNext)) {
      targets.push({ label: "admin-next", file });
    }
  }

  for (const [key, label] of [
    ["mobileApk", "mobile-apk"],
    ["watchApk", "watch-apk"],
  ]) {
    const artifactPath = options[key];
    if (!artifactPath) continue;
    if (!fs.existsSync(artifactPath)) {
      fail(`${label} not found: ${artifactPath}`);
    }
    targets.push({ label, file: artifactPath });
  }

  return targets;
}

function validateArtifacts(targets) {
  let canonicalFound = false;
  const forbiddenHits = [];

  for (const { label, file } of targets) {
    const content = readSearchableContent(file);

    if (contentIncludes(content, CANONICAL_API_URL)) {
      canonicalFound = true;
    }

    for (const marker of FORBIDDEN_MARKERS) {
      if (contentIncludes(content, marker)) {
        forbiddenHits.push({ label, file, marker });
      }
    }
  }

  if (!canonicalFound) {
    fail(
      `canonical API URL "${CANONICAL_API_URL}" not found in any scanned artifact`,
    );
  }

  if (forbiddenHits.length) {
    const summary = forbiddenHits
      .slice(0, 10)
      .map((hit) => `  [${hit.label}] ${hit.marker} in ${hit.file}`)
      .join("\n");
    fail(
      `forbidden URL markers found:\n${summary}${
        forbiddenHits.length > 10 ? `\n  ... and ${forbiddenHits.length - 10} more` : ""
      }`,
    );
  }

  const scanned = targets.length;
  console.log(
    `validate-staging-artifacts: passed (${scanned} file(s), canonical=${CANONICAL_API_URL}).`,
  );
}

const options = parseArgs(process.argv.slice(2));
const targets = collectTargets(options);
validateArtifacts(targets);
