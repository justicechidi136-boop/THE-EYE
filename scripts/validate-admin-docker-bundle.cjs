const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const [image, expectedEnv, expectedApiUrl] = process.argv.slice(2);

if (!image || !expectedEnv || !expectedApiUrl) {
  console.error("Usage: node scripts/validate-admin-docker-bundle.cjs <image> <api-env> <api-url>");
  process.exit(1);
}

const oppositeApiUrl =
  expectedEnv === "staging"
    ? process.env.CI_PRODUCTION_API_URL || "https://ci-production-api.example.test"
    : process.env.CI_STAGING_API_URL || "https://ci-staging-api.example.test";

const oppositeMarkers = [oppositeApiUrl];

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (/\.(js|json|html|txt|map)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function searchBundle(bundleRoot, needle) {
  const matches = [];
  for (const file of walkFiles(bundleRoot)) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes(needle)) {
      matches.push(file);
    }
  }
  return matches;
}

const containerName = `the-eye-admin-bundle-${Date.now()}`;
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "the-eye-admin-bundle-"));

try {
  run(`docker create --name ${containerName} ${image}`);
  run(`docker cp ${containerName}:/app/apps/admin-web/.next ${workDir}`);

  const bundleRoot = path.join(workDir, ".next");
  if (!fs.existsSync(bundleRoot)) {
    throw new Error(`Missing .next output in image ${image}`);
  }

  const envFiles = run(
    `docker run --rm --entrypoint sh ${image} -c "find /app -maxdepth 4 -name '.env*' -print"`,
  );
  if (envFiles) {
    throw new Error(`Image contains env files: ${envFiles}`);
  }

  const expectedHits = searchBundle(bundleRoot, expectedApiUrl);
  if (!expectedHits.length) {
    throw new Error(`Expected API URL "${expectedApiUrl}" was not found in ${image} bundle`);
  }

  for (const marker of oppositeMarkers) {
    const leakHits = searchBundle(bundleRoot, marker);
    if (leakHits.length) {
      throw new Error(`Cross-environment marker "${marker}" found in ${expectedEnv} image bundle`);
    }
  }

  const runtimeEnv = run(
    `docker run --rm --entrypoint sh ${image} -c "env"`,
  ).split("\n").filter((line) => line.startsWith("NEXT_PUBLIC_"));
  if (runtimeEnv.length) {
    throw new Error(`Runtime image retained NEXT_PUBLIC_* environment variables: ${runtimeEnv.join(", ")}`);
  }

  console.log(`Bundle isolation passed for ${image} (${expectedEnv}, ${expectedApiUrl}).`);
} catch (error) {
  console.error(`Bundle isolation failed for ${image}: ${error.message}`);
  process.exit(1);
} finally {
  try {
    run(`docker rm ${containerName}`);
  } catch {
    // container may not have been created
  }
  fs.rmSync(workDir, { recursive: true, force: true });
}
