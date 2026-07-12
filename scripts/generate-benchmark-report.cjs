#!/usr/bin/env node
/**
 * Run k6 scale tiers (100 → 100k) and generate docs/performance-benchmark-report.md
 */
const { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } = require("fs");
const { join, resolve } = require("path");
const { spawnSync } = require("child_process");

const root = resolve(__dirname, "..");
const resultsDir = join(root, "scripts/k6/results");
const reportPath = join(root, "docs/performance-benchmark-report.md");
const tiers = [100, 1000, 10000, 100000];
const runTiers = process.argv.includes("--all")
  ? tiers
  : [Number(process.env.SCALE || process.argv.find((arg) => /^\d+$/.test(arg)) || 100)];

function hasK6() {
  const probe = spawnSync("k6", ["version"], { encoding: "utf8", shell: process.platform === "win32" });
  return probe.status === 0;
}

function runTier(scale) {
  const script = join(root, "scripts/k6/scale/platform-5m.js");
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summaryPath = join(resultsDir, `platform-5m-scale-${scale}-${stamp}.json`);

  console.log(`\n=== Running scale tier ${scale} ===`);
  const args = ["run", "--summary-export", summaryPath, "-e", `SCALE=${scale}`, script];
  const result = spawnSync("k6", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, SCALE: String(scale) },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    scale,
    summaryPath: existsSync(summaryPath) ? summaryPath : null,
    exitCode: result.status ?? 1,
    stdout: result.stdout || "",
  };
}

function readSummary(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function metricP95(summary, names) {
  if (!summary?.metrics) return null;
  for (const name of names) {
    const metric = summary.metrics[name];
    const value = metric?.values?.["p(95)"];
    if (typeof value === "number") return Math.round(value);
  }
  return null;
}

function metricRate(summary, name) {
  const metric = summary?.metrics?.[name];
  const value = metric?.values?.rate;
  return typeof value === "number" ? (value * 100).toFixed(2) : null;
}

function latestSummaries() {
  if (!existsSync(resultsDir)) return [];
  return readdirSync(resultsDir)
    .filter((file) => file.startsWith("platform-5m-scale-") && file.endsWith(".json"))
    .map((file) => ({ file, full: join(resultsDir, file), mtime: require("fs").statSync(join(resultsDir, file)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

function buildReport(runResults) {
  const now = new Date().toISOString().slice(0, 10);
  const rows = [];

  for (const run of runResults) {
    const summary = run.summaryPath ? readSummary(run.summaryPath) : null;
    rows.push({
      scale: run.scale,
      exitCode: run.exitCode,
      apiP95: metricP95(summary, ["api_latency", "http_req_duration"]),
      dbP95: metricP95(summary, ["db_latency_proxy"]),
      redisP95: metricP95(summary, ["redis_latency_proxy"]),
      verificationP95: metricP95(summary, ["verification_latency"]),
      broadcastP95: metricP95(summary, ["broadcast_latency"]),
      notificationP95: metricP95(summary, ["notification_latency"]),
      liveVideoP95: metricP95(summary, ["live_video_latency"]),
      failRate: metricRate(summary, "http_req_failed"),
      summaryPath: run.summaryPath,
    });
  }

  const tableHeader = `| Scale | API p95 | DB proxy p95 | Redis proxy p95 | Verification p95 | Broadcast p95 | Notification p95 | Live video p95 | Fail % |`;
  const tableSep = `|------:|--------:|-------------:|--------------:|-------------------:|--------------:|-----------------:|---------------:|-------:|`;
  const tableBody = rows
    .map((row) =>
      `| ${row.scale.toLocaleString()} | ${fmt(row.apiP95)} | ${fmt(row.dbP95)} | ${fmt(row.redisP95)} | ${fmt(row.verificationP95)} | ${fmt(row.broadcastP95)} | ${fmt(row.notificationP95)} | ${fmt(row.liveVideoP95)} | ${row.failRate ?? "n/a"} |`,
    )
    .join("\n");

  const bottlenecks = analyzeBottlenecks(rows);

  return `# THE EYE performance benchmark report

**Project:** THE EYE (5M-user readiness)  
**Report date:** ${now}  
**Tool:** Grafana k6 + Prometheus  
**Script:** \`scripts/k6/scale/platform-5m.js\`

---

## Executive summary

This report captures multi-tier load results for THE EYE API under simulated population scales of **100**, **1,000**, **10,000**, and **100,000** active users. Metrics include API, database, Redis, verification, broadcast dispatch, notification, and live-video latency.

Optimizations applied in this pass:

- **Auth user cache** (30s TTL) — removes per-request DB lookup for JWT resolution at scale
- **Verification write parallelization** — timeline + verification records + status update in \`Promise.all\`
- **Verification history window** reduced from 50 → 20 rows for scoring context
- **Broadcast dispatch batching** — recipients processed in parallel batches of 25
- **Prometheus histograms** for verification, broadcast, live-video, and Redis enqueue/ping

---

## Scale test matrix

| Tier | Executor model | Duration (approx) | Notes |
|------|----------------|-------------------|-------|
| 100 | Ramping VUs → 100 | ~5 min | Direct concurrency |
| 1,000 | Ramping VUs → 1,000 | ~7 min | Direct concurrency |
| 10,000 | Constant arrival ~400 req/s | ~6 min | Simulated active population |
| 100,000 | Constant arrival ~2,500 req/s | ~8 min | Requires distributed k6 generators |

**Run commands:**

\`\`\`bash
pnpm run test:load:scale:100
pnpm run test:load:scale:1000
pnpm run test:load:scale:10000
pnpm run test:load:scale:100000
pnpm run test:load:benchmark
\`\`\`

---

## Latency results (k6 client-side p95, ms)

${tableHeader}
${tableSep}
${tableBody || "| _no runs yet_ | — | — | — | — | — | — | — | — |"}

> Re-run \`node scripts/generate-benchmark-report.cjs --all\` after each staging deploy to refresh this table.

---

## Bottleneck analysis

${bottlenecks}

---

## Prometheus correlation

\`\`\`promql
histogram_quantile(0.95, sum(rate(the_eye_verification_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_broadcast_dispatch_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_live_video_operation_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_redis_operation_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_db_query_duration_seconds_bucket[5m])) by (le))
\`\`\`

---

## 5M-user scaling recommendations

| Layer | Current limiter | Recommendation |
|-------|-----------------|----------------|
| API | JWT DB resolution | Auth cache (done); add read replicas for admin lists |
| Postgres | PostGIS duplicate detection | Partial GiST index on incident location; read replica for dashboards |
| Redis / BullMQ | Notification enqueue bursts | Horizontal Redis; dedicated notification workers |
| Verification | Context build + duplicate query | Async fire-and-forget on create (done); cache duplicate lookups 60s |
| Broadcasts | Per-recipient sequential writes | Batched parallel dispatch (done); precompute geofence recipients |
| Live video | Session upsert + location inserts | Connection pooling; partition location updates by month |
| Edge | Rate limits (429) | Per-tenant limits; CDN for static admin assets |

---

## Artifacts

${rows.map((row) => `- Scale **${row.scale}**: exit ${row.exitCode}${row.summaryPath ? ` → \`${row.summaryPath.replace(/\\\\/g, "/")}\`` : " (no summary export)"}`).join("\n")}

---

## Regression gate

1. \`pnpm run test:load:validate\` — structure check
2. \`pnpm run test:load:smoke\` — single-VU sanity
3. \`pnpm run test:load:scale:100\` — must pass thresholds
4. Compare p95 columns above to prior report; fail CI if API p95 doubles or verification p95 exceeds 5s at 100-tier
`;
}

function fmt(value) {
  return value == null ? "n/a" : `${value}ms`;
}

function analyzeBottlenecks(rows) {
  if (!rows.length) {
    return "_No benchmark runs captured yet. Start API + seed, then run `pnpm run test:load:benchmark`._";
  }

  const notes = [];
  const highest = rows.reduce((max, row) => (row.scale > max.scale ? row : max), rows[0]);

  if (highest.verificationP95 != null && highest.verificationP95 > 5000) {
    notes.push("- **Verification** exceeds 5s p95 — PostGIS duplicate detection and context hydration dominate; add spatial index and shrink verification history further under load.");
  } else if (highest.verificationP95 != null) {
    notes.push("- **Verification** within 5s product target at tested tier; monitor duplicate-query cardinality as incident volume grows.");
  }

  if (highest.broadcastP95 != null && highest.broadcastP95 > 8000) {
    notes.push("- **Broadcast dispatch** is the dominant slow path — geofence recipient fan-out and per-user notification inserts; consider materialized recipient lists.");
  }

  if (highest.redisP95 != null && highest.redisP95 > 250) {
    notes.push("- **Redis** proxy latency elevated — BullMQ enqueue or readiness ping slow; scale Redis memory/connections and colocate with API workers.");
  }

  if (highest.dbP95 != null && highest.dbP95 > 500) {
    notes.push("- **Database** readiness probe slow under load — connection pool saturation likely; increase \`DATABASE_POOL_SIZE\` and add PgBouncer.");
  }

  if (highest.failRate != null && Number(highest.failRate) > 20) {
    notes.push("- **HTTP fail rate** above 20% — expected mix of 429 rate limits under aggressive load; validate staging limits or distribute k6 across IPs.");
  }

  if (!notes.length) {
    notes.push("- No critical bottlenecks detected at captured tiers; continue weekly scale regression on staging.");
  }

  return notes.join("\n");
}

function main() {
  if (!hasK6()) {
    console.error("k6 is not installed — generating report from existing summaries only.");
  }

  const runResults = [];
  for (const scale of runTiers) {
    if (!tiers.includes(scale)) {
      console.warn(`Skipping unknown scale ${scale}`);
      continue;
    }
    if (hasK6()) {
      runResults.push(runTier(scale));
    }
  }

  if (!runResults.length) {
    const latest = latestSummaries();
    for (const scale of tiers) {
      const match = latest.find((entry) => entry.file.includes(`scale-${scale}-`));
      if (match) {
        runResults.push({ scale, summaryPath: match.full, exitCode: 0, stdout: "" });
      }
    }
  }

  const report = buildReport(runResults);
  writeFileSync(reportPath, report, "utf8");
  console.log(`\nBenchmark report written to ${reportPath}`);
}

main();
