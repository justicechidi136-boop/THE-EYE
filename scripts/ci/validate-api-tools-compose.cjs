const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const composePath = path.join(root, "infra", "docker", "docker-compose.yml");
const compose = fs.readFileSync(composePath, "utf8");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "apps", "api", "package.json"), "utf8"),
);

const required = [
  "api-tools:",
  'profiles: ["tools"]',
  "the-eye-api-tools:${THE_EYE_IMAGE_TAG:-local}",
  "target: tools",
  'restart: "no"',
  "seed-staging-test-accounts.ts",
  "THE_EYE_APP_ENV: ${THE_EYE_APP_ENV:-staging}",
];

const missing = required.filter((needle) => !compose.includes(needle));
if (missing.length) {
  console.error("validate-api-tools-compose failed. Missing:", missing.join(", "));
  process.exit(1);
}

if (!packageJson.scripts["seed:staging:test-accounts"]) {
  console.error("validate-api-tools-compose failed. Missing seed:staging:test-accounts script.");
  process.exit(1);
}

if (!packageJson.scripts["verify:staging:certification-data"]) {
  console.error(
    "validate-api-tools-compose failed. Missing verify:staging:certification-data script.",
  );
  process.exit(1);
}

console.log("validate-api-tools-compose: passed");
