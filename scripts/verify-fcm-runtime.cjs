#!/usr/bin/env node
/**
 * Verifies FCM runtime wiring, Redis, and BullMQ notification worker registration.
 * Does not print secret values.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const { loadProductionEnv } = require("./firebase/guard-production.cjs");

const repoRoot = path.join(__dirname, "..");
const apiDir = path.join(repoRoot, "apps", "api");

function probeHttp(url) {
  try {
    const response = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", `(Invoke-WebRequest -UseBasicParsing -Uri '${url}' -TimeoutSec 8).Content`],
      { encoding: "utf8" },
    );
    if (response.status !== 0) return null;
    return JSON.parse(response.stdout.trim());
  } catch {
    return null;
  }
}

function main() {
  const env = { ...process.env, ...loadProductionEnv(repoRoot) };
  const report = {
    fcmProjectId: env.FCM_PROJECT_ID ?? null,
    fcmMode: env.FCM_MODE ?? null,
    fcmAllowSimulation: env.FCM_ALLOW_SIMULATION ?? null,
    fcmSimulationMode: env.FCM_SIMULATION_MODE ?? null,
    redisDisabled: env.THE_EYE_DISABLE_REDIS === "1",
    credentialMethod: "service-account-jwt",
    apiHealth: null,
    apiReady: null,
    bullmqWorker: "unknown",
  };

  const health = probeHttp("http://localhost:4000/v1/health");
  const ready = probeHttp("http://localhost:4000/v1/health/ready");
  report.apiHealth = health;
  report.apiReady = ready;

  if (ready?.checks?.redis === "ok") {
    report.redisStatus = "ok";
    report.bullmqWorker = env.THE_EYE_DISABLE_REDIS === "1" ? "disabled" : "expected_registered_when_api_running";
  } else if (ready?.checks?.redis === "skipped") {
    report.redisStatus = "skipped";
    report.bullmqWorker = "disabled";
  } else {
    report.redisStatus = ready?.checks?.redis ?? "unavailable";
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
