#!/usr/bin/env node
/**
 * Scans git-tracked files for exposed secrets (Google API keys, private keys, .env files).
 * Run in CI and locally before pushing: pnpm run test:secrets
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

const GOOGLE_API_KEY_PATTERN = /AIza[0-9A-Za-z_-]{20,}/;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/;
const PLACEHOLDER_PREFIXES = [
  "REPLACE_WITH_",
  "YOUR_GOOGLE_API_KEY",
  "YOUR_",
  "change_me",
  "ci_",
];

const ALLOWED_PRIVATE_KEY_PATHS = [
  /^apps\/api\/src\/.*\.spec\.ts$/,
  /^apps\/api\/src\/.*\/__tests__\//,
  /^scripts\/firebase-guard-production\.test\.cjs$/,
  /^docs\//,
  /^apps\/api\/\.env\.example$/,
  /^\.env\.example$/,
];

function isPlaceholder(value) {
  const trimmed = String(value).trim();
  return PLACEHOLDER_PREFIXES.some((prefix) =>
    trimmed.toUpperCase().startsWith(prefix.toUpperCase()),
  );
}

function listTrackedFiles() {
  const output = execSync("git ls-files -z", {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return output.split("\0").filter(Boolean);
}

function relativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

const failures = [];
const tracked = listTrackedFiles();

for (const file of tracked) {
  const normalized = relativePath(file);
  const basename = path.basename(normalized);

  if (/^\.env(\.|$)/.test(basename) && !basename.endsWith(".example")) {
    failures.push(`tracked env file must not be committed: ${normalized}`);
    continue;
  }

  const fullPath = path.join(repoRoot, file);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) continue;

  let source;
  try {
    source = fs.readFileSync(fullPath, "utf8");
  } catch {
    continue;
  }

  const apiKeyMatch = source.match(GOOGLE_API_KEY_PATTERN);
  if (apiKeyMatch && !isPlaceholder(apiKeyMatch[0])) {
    failures.push(
      `Google API key in tracked file: ${normalized} (${apiKeyMatch[0].slice(0, 8)}...${apiKeyMatch[0].slice(-4)})`,
    );
  }

  if (PRIVATE_KEY_PATTERN.test(source)) {
    const allowed = ALLOWED_PRIVATE_KEY_PATHS.some((pattern) =>
      pattern.test(normalized),
    );
    if (!allowed) {
      failures.push(`private key material in tracked file: ${normalized}`);
    }
  }
}

const gitignorePath = path.join(repoRoot, ".gitignore");
const gitignore = fs.readFileSync(gitignorePath, "utf8");
const requiredPatterns = [
  { label: "google-services.json", pattern: /google-services\.json/ },
  { label: ".env files", pattern: /\*\*\/\.env/ },
  { label: "firebase-adminsdk JSON", pattern: /firebase-adminsdk/ },
  { label: "*.p8", pattern: /\*\.p8/ },
];

for (const { label, pattern } of requiredPatterns) {
  if (!pattern.test(gitignore)) {
    failures.push(`.gitignore missing pattern for ${label}`);
  }
}

if (failures.length) {
  console.error("Secret scan failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      trackedFilesScanned: tracked.length,
      message: "No exposed Google API keys or private keys in tracked files",
    },
    null,
    2,
  ),
);
