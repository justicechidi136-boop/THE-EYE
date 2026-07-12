const fs = require("fs");
const path = require("path");

const [bundleDir, expectedEnv, expectedApiUrl] = process.argv.slice(2);

if (!bundleDir || !expectedEnv || !expectedApiUrl) {
  console.error("Usage: node scripts/validate-admin-next-bundle.cjs <.next-dir> <env> <api-url>");
  process.exit(1);
}

const oppositeApiUrl =
  expectedEnv === "staging"
    ? process.env.CI_PRODUCTION_API_URL || "https://ci-production-api.theeye.internal"
    : process.env.CI_STAGING_API_URL || "https://ci-staging-api.theeye.internal";

const oppositeMarkers = [oppositeApiUrl];

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, files);
    else if (/\.(js|json|html|txt|map)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function searchBundle(root, needle) {
  const matches = [];
  for (const file of walkFiles(root)) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes(needle)) matches.push(file);
  }
  return matches;
}

if (!fs.existsSync(bundleDir)) {
  console.error(`Bundle directory not found: ${bundleDir}`);
  process.exit(1);
}

const expectedHits = searchBundle(bundleDir, expectedApiUrl);
if (!expectedHits.length) {
  console.error(`Expected API URL "${expectedApiUrl}" not found in ${bundleDir}`);
  process.exit(1);
}

for (const marker of oppositeMarkers) {
  const leakHits = searchBundle(bundleDir, marker);
  if (leakHits.length) {
    console.error(`Cross-environment marker "${marker}" found in ${expectedEnv} bundle`);
    process.exit(1);
  }
}

console.log(`Next bundle isolation passed (${expectedEnv}, ${expectedApiUrl}).`);
