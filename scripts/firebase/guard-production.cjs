const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const { DEV_PROJECT_ID, PROD_PROJECT_ID } = require("./constants.cjs");
const { readFirebaserc } = require("./read-firebaserc.cjs");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** process.env overrides file values when both are set. */
function loadEnvWithProcessPriority(filePath) {
  const fileEnv = parseEnvFile(filePath);
  const merged = { ...fileEnv };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

function normalizePrivateKeyForValidation(value) {
  return String(value ?? "").replace(/\\n/g, "\n").trim();
}

function isFcmSimulationEnabled(env) {
  if (env.FCM_ALLOW_SIMULATION === "true" || env.FCM_ALLOW_SIMULATION === "1") return true;
  if (env.FCM_SIMULATION_MODE === "true" || env.FCM_SIMULATION_MODE === "1") return true;
  if (env.FCM_MODE && env.FCM_MODE !== "real") return true;
  const projectId = String(env.FCM_PROJECT_ID ?? "").trim();
  const clientEmail = String(env.FCM_CLIENT_EMAIL ?? "").trim();
  const privateKey = normalizePrivateKeyForValidation(env.FCM_PRIVATE_KEY);
  return !projectId || !clientEmail || !privateKey;
}

/**
 * @param {{
 *   fcmProjectId?: string;
 *   fcmClientEmail?: string;
 *   fcmPrivateKey?: string;
 *   fcmAllowSimulation?: string;
 *   fcmSimulationMode?: string;
 *   fcmMode?: string;
 *   theEyeDisableRedis?: string;
 *   activeFirebaseProjectId?: string | null;
 * }} input
 */
function validateProductionFirebase(input) {
  const errors = [];
  const fcmProjectId = String(input.fcmProjectId ?? "").trim();
  const fcmClientEmail = String(input.fcmClientEmail ?? "").trim();
  const fcmPrivateKey = normalizePrivateKeyForValidation(input.fcmPrivateKey);
  const fcmAllowSimulation = String(input.fcmAllowSimulation ?? "").trim();
  const fcmSimulationMode = String(input.fcmSimulationMode ?? "").trim();
  const fcmMode = String(input.fcmMode ?? "").trim();
  const theEyeDisableRedis = String(input.theEyeDisableRedis ?? "").trim();
  const activeFirebaseProjectId = input.activeFirebaseProjectId
    ? String(input.activeFirebaseProjectId).trim()
    : null;

  if (!fcmProjectId) errors.push("FCM_PROJECT_ID is required for production");
  if (!fcmClientEmail) errors.push("FCM_CLIENT_EMAIL is required for production");
  if (!fcmPrivateKey) errors.push("FCM_PRIVATE_KEY is required for production");

  if (fcmProjectId && fcmProjectId !== PROD_PROJECT_ID) {
    errors.push(`FCM_PROJECT_ID must be ${PROD_PROJECT_ID} in production (got ${fcmProjectId})`);
  }

  if (fcmProjectId === DEV_PROJECT_ID) {
    errors.push(`Development Firebase project ${DEV_PROJECT_ID} must not appear in production configuration`);
  }

  if (fcmMode !== "real") {
    errors.push(`FCM_MODE must be real in production (got ${fcmMode || "<missing>"})`);
  }

  if (fcmAllowSimulation !== "false") {
    errors.push(`FCM_ALLOW_SIMULATION must be false in production (got ${fcmAllowSimulation || "<missing>"})`);
  }

  if (fcmSimulationMode !== "false") {
    errors.push(`FCM_SIMULATION_MODE must be false in production (got ${fcmSimulationMode || "<missing>"})`);
  }

  if (theEyeDisableRedis !== "0") {
    errors.push(`THE_EYE_DISABLE_REDIS must be 0 in production (got ${theEyeDisableRedis || "<missing>"})`);
  }

  if (activeFirebaseProjectId && activeFirebaseProjectId !== PROD_PROJECT_ID) {
    errors.push(`Active Firebase CLI project must be ${PROD_PROJECT_ID} (got ${activeFirebaseProjectId})`);
  }

  if (activeFirebaseProjectId === DEV_PROJECT_ID) {
    errors.push(`Development Firebase project ${DEV_PROJECT_ID} must not be selected for production operations`);
  }

  if (
    isFcmSimulationEnabled({
      FCM_PROJECT_ID: fcmProjectId,
      FCM_CLIENT_EMAIL: fcmClientEmail,
      FCM_PRIVATE_KEY: fcmPrivateKey,
      FCM_ALLOW_SIMULATION: fcmAllowSimulation,
      FCM_SIMULATION_MODE: fcmSimulationMode,
      FCM_MODE: fcmMode,
    })
  ) {
    errors.push("FCM simulation mode is enabled (missing credentials or simulation flags set)");
  }

  return { ok: errors.length === 0, errors };
}

function resolveActiveFirebaseProjectId(repoRoot) {
  try {
    return execSync("firebase use", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    const { aliases } = readFirebaserc(repoRoot);
    return aliases.default ?? null;
  }
}

function loadProductionEnv(repoRoot = path.join(__dirname, "..", "..")) {
  const apiEnvPath = path.join(repoRoot, "apps", "api", ".env");
  return loadEnvWithProcessPriority(apiEnvPath);
}

function main() {
  const repoRoot = path.join(__dirname, "..", "..");
  const env = loadProductionEnv(repoRoot);
  const result = validateProductionFirebase({
    fcmProjectId: env.FCM_PROJECT_ID,
    fcmClientEmail: env.FCM_CLIENT_EMAIL,
    fcmPrivateKey: env.FCM_PRIVATE_KEY,
    fcmAllowSimulation: env.FCM_ALLOW_SIMULATION,
    fcmSimulationMode: env.FCM_SIMULATION_MODE,
    fcmMode: env.FCM_MODE,
    theEyeDisableRedis: env.THE_EYE_DISABLE_REDIS,
    activeFirebaseProjectId: resolveActiveFirebaseProjectId(repoRoot),
  });

  if (!result.ok) {
    console.error("Firebase production guard failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Firebase production guard passed (project ${PROD_PROJECT_ID}, FCM live mode).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateProductionFirebase,
  isFcmSimulationEnabled,
  resolveActiveFirebaseProjectId,
  loadProductionEnv,
  loadEnvWithProcessPriority,
  parseEnvFile,
  normalizePrivateKeyForValidation,
};
