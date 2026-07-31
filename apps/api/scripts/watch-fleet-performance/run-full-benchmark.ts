#!/usr/bin/env tsx
/**
 * Full watch fleet benchmark — run ONLY against isolated perf database.
 *
 * Usage:
 *   DATABASE_URL=postgres://perf... \
 *   WATCH_FLEET_BENCH_OWNER_ID=<uuid> \
 *   tsx scripts/watch-fleet-performance/run-full-benchmark.ts
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const ITERATIONS = Number(process.env.WATCH_FLEET_BENCH_ITERATIONS ?? 30);
const OWNER_TYPE = process.env.WATCH_FLEET_BENCH_OWNER_TYPE ?? "PERSON";
const OWNER_ID = process.env.WATCH_FLEET_BENCH_OWNER_ID;

function percentile(samples: number[], p: number) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)] ?? 0;
}

async function benchOwnerSummary() {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const started = performance.now();
    await prisma.$queryRaw`
      WITH scoped_devices AS (
        SELECT d.id, d.current_owner_type, d.current_owner_id, d.is_online, d.battery_level,
               d.last_sos_at, d.assignment_status, d.ownership_status, d.last_seen_at
        FROM smartwatch_devices d
        LEFT JOIN profiles p ON d.current_owner_type = 'PERSON' AND p.user_id = d.current_owner_id
        LEFT JOIN watch_organizations o ON d.current_owner_type = 'ORGANIZATION' AND o.id = d.current_owner_id
      ),
      agg AS (
        SELECT sd.current_owner_type, sd.current_owner_id,
               COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE sd.is_online = true)::bigint AS online_count,
               COUNT(*) FILTER (WHERE sd.ownership_status = 'REPLACEMENT_PENDING')::bigint AS replacement_pending_count,
               MAX(sd.last_seen_at) AS last_activity
        FROM scoped_devices sd
        GROUP BY sd.current_owner_type, sd.current_owner_id
      )
      SELECT * FROM agg
      WHERE current_owner_type = ${OWNER_TYPE}
      ORDER BY total DESC
      LIMIT 51
    `;
    samples.push(performance.now() - started);
  }
  return { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), p99: percentile(samples, 0.99) };
}

async function benchInventoryPage(filter?: Record<string, unknown>) {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const started = performance.now();
    await prisma.smartwatchDevice.findMany({
      where: filter as never,
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: 51,
      select: { id: true, deviceId: true, ownershipStatus: true, isOnline: true, batteryLevel: true },
    });
    samples.push(performance.now() - started);
  }
  return { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), p99: percentile(samples, 0.99) };
}

async function benchFilteredQuery(label: string, where: Record<string, unknown>) {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const started = performance.now();
    await prisma.smartwatchDevice.findMany({ where: where as never, take: 51, select: { id: true } });
    samples.push(performance.now() - started);
  }
  return { label, p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), p99: percentile(samples, 0.99) };
}

async function explainCriticalQueries() {
  const plans: Record<string, string[]> = {};

  const ownerAgg = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT d.current_owner_type, d.current_owner_id,
           COUNT(*) FILTER (WHERE d.is_online = true) AS online_count
    FROM smartwatch_devices d
    WHERE d.current_owner_type = '${OWNER_TYPE}'
    GROUP BY d.current_owner_type, d.current_owner_id
    LIMIT 51
  `);
  plans.ownerAggregate = (ownerAgg as { "QUERY PLAN": string }[]).map((r) => r["QUERY PLAN"]);

  const replacement = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id FROM smartwatch_devices
    WHERE ownership_status = 'REPLACEMENT_PENDING'
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT 51
  `);
  plans.replacementPending = (replacement as { "QUERY PLAN": string }[]).map((r) => r["QUERY PLAN"]);

  const lostStolen = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id FROM smartwatch_devices
    WHERE ownership_status = 'LOST_OR_STOLEN'
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT 51
  `);
  plans.lostOrStolen = (lostStolen as { "QUERY PLAN": string }[]).map((r) => r["QUERY PLAN"]);

  return plans;
}

async function main() {
  const deviceCount = await prisma.smartwatchDevice.count();
  const ownerDeviceCount = OWNER_ID
    ? await prisma.smartwatchDevice.count({ where: { currentOwnerId: OWNER_ID, currentOwnerType: OWNER_TYPE } })
    : null;

  const ownerSummary = await benchOwnerSummary();
  const inventoryFirstPage = await benchInventoryPage(
    OWNER_ID ? { currentOwnerId: OWNER_ID, currentOwnerType: OWNER_TYPE } : undefined,
  );
  const filteredInventory = await benchInventoryPage(
    OWNER_ID
      ? { currentOwnerId: OWNER_ID, currentOwnerType: OWNER_TYPE, ownershipStatus: "ASSIGNED", isOnline: true }
      : { ownershipStatus: "ASSIGNED", isOnline: true },
  );
  const replacementPending = await benchFilteredQuery("replacement_pending", { ownershipStatus: "REPLACEMENT_PENDING" });
  const lostOrStolen = await benchFilteredQuery("lost_or_stolen", { ownershipStatus: "LOST_OR_STOLEN" });
  const queryPlans = await explainCriticalQueries();

  const results = {
    measuredAt: new Date().toISOString(),
    databaseDeviceCount: deviceCount,
    ownerDeviceCount,
    iterations: ITERATIONS,
    ownerSummaryMs: ownerSummary,
    inventoryFirstPageMs: inventoryFirstPage,
    filteredInventoryMs: filteredInventory,
    replacementPendingMs: replacementPending,
    lostOrStolenMs: lostOrStolen,
    acceptance: {
      ownerSummaryP95Pass: ownerSummary.p95 < 500,
      inventoryFirstPageP95Pass: inventoryFirstPage.p95 < 750,
      filteredPageP95Pass: filteredInventory.p95 < 1000,
    },
    queryPlans,
  };

  const outPath = join(process.cwd(), "artifacts", "watch-fleet-benchmark-results.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
