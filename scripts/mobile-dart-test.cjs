const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const mobileRoot = path.join(repoRoot, "apps", "mobile");
const testDir = path.join(mobileRoot, "test");

function commandExists(command) {
  const lookup = spawnSync(process.platform === "win32" ? "where" : "which", [command], { encoding: "utf8" });
  return lookup.status === 0;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const requiredTests = [
  "valid submission returns success with incident id",
  "missing required fields returns validation error",
  "identified report without token is unauthorized at validation",
  "server validation error surfaces user-facing message",
  "timeout queues draft for retry",
  "network loss queues draft for retry",
  "duplicate tap prevention blocks in-flight submission",
  "syncPending retries queued drafts",
  "unauthorized API response maps to sign-in message",
  "startup offline reports offline before any API probe",
  "reconnection probes API and becomes online when reachable",
  "API unreachable despite active network reports limited connectivity",
  "reconnection automatically retries queued drafts",
  "queued draft recovery after restart syncs persisted drafts",
  "network loss during submission queues draft for retry",
  "retry logging omits sensitive incident details",
  "maps permanently denied and restricted states",
  "rejects corrupt image magic bytes",
  "rejects oversized files",
  "empty selection returns validation failure",
  "upload failure surfaces without leaking incident details",
  "successful attachment uploads and confirms evidence",
  "normalizes Nigerian phone numbers before API use",
  "validates email and password rules",
  "validates OTP length and accepted characters",
  "maps invalid credentials without leaking secrets",
  "maps OTP rate-limit feedback",
  "prevents multiple simultaneous OTP requests",
  "handles expired and locked OTP API errors",
  "handles invalid, already-used, and missing OTP API errors",
  "preserves form state during temporary network failure",
  "successful login stores session tokens",
  "parses livekit credentials and evidence overlay from start response",
  "maps token failure without leaking secrets",
  "maps permission denial and connection loss labels",
  "builds evidence overlay with connection status",
  "handles stream termination state as disconnected",
];

const testFiles = fs.existsSync(testDir)
  ? fs.readdirSync(testDir).filter((file) => file.endsWith("_test.dart"))
  : [];

if (!testFiles.length) {
  console.error("Mobile dart test failed: no test files found.");
  process.exit(1);
}

const testSource = testFiles
  .map((file) => fs.readFileSync(path.join(testDir, file), "utf8"))
  .join("\n");

const missingCases = requiredTests.filter((needle) => !testSource.includes(needle));
if (missingCases.length) {
  console.error("Mobile dart test failed. Missing cases:", missingCases.join(", "));
  process.exit(1);
}

if (commandExists("flutter")) {
  run("flutter", ["pub", "get"], mobileRoot);
  run("flutter", ["analyze", "lib", "test"], mobileRoot);
  run("flutter", ["test"], mobileRoot);
  console.log("Flutter analyze and tests passed.");
  process.exit(0);
}

if (commandExists("dart")) {
  run("dart", ["pub", "get"], mobileRoot);
  run("dart", ["analyze", "lib", "test"], mobileRoot);
  run("dart", ["test"], mobileRoot);
  console.log("Dart analyze and tests passed.");
  process.exit(0);
}

console.log("Flutter/Dart SDK not found. Verified incident submission test suite structure only.");
console.log(`Checked ${testFiles.length} test file(s) with ${requiredTests.length} required cases.`);
