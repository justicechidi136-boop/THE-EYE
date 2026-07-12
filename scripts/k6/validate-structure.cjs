const { existsSync } = require("fs");
const { join } = require("path");

const root = join(__dirname, "..", "..");
const required = [
  "scripts/k6/smoke.js",
  "scripts/k6/combined.js",
  "scripts/k6/scale/platform-5m.js",
  "scripts/k6/env.example",
  "scripts/k6/lib/config.js",
  "scripts/k6/lib/auth.js",
  "scripts/k6/lib/latency-trends.js",
  "scripts/k6/lib/scale-profiles.js",
  "scripts/k6/lib/prometheus-snapshot.js",
  "scripts/k6/scenarios/auth-login-burst.js",
  "scripts/k6/scenarios/incident-submission.js",
  "scripts/k6/scenarios/sos-submission.js",
  "scripts/k6/scenarios/broadcast-dispatch.js",
  "scripts/k6/scenarios/notification-queue.js",
  "scripts/k6/scenarios/admin-incident-list.js",
  "scripts/k6/scenarios/live-gps-updates.js",
  "scripts/k6/scenarios/verification-latency.js",
  "scripts/generate-benchmark-report.cjs",
  "docs/load-testing.md",
  "docs/load-testing-baseline.md",
  "docs/performance-benchmark-report.md",
];

let missing = 0;
for (const file of required) {
  const full = join(root, file);
  if (!existsSync(full)) {
    console.error(`missing: ${file}`);
    missing += 1;
  }
}

if (missing) {
  console.error(`k6 load test structure incomplete (${missing} missing files)`);
  process.exit(1);
}

console.log(`k6 load test structure ok (${required.length} files)`);
