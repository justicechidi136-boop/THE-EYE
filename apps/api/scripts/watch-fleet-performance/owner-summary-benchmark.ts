#!/usr/bin/env tsx
/**
 * Watch fleet performance probe — run against a dedicated staging perf database only.
 *
 * Usage:
 *   DATABASE_URL=postgres://... tsx scripts/watch-fleet-performance/owner-summary-benchmark.ts
 *
 * Does NOT insert 1M rows; expects pre-seeded dataset or uses EXPLAIN on representative aggregate SQL.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const iterations = Number(process.env.WATCH_FLEET_BENCH_ITERATIONS ?? 20);
  const ownerType = process.env.WATCH_FLEET_BENCH_OWNER_TYPE ?? "PERSON";
  const samples: number[] = [];

  const sosCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    await prisma.$queryRaw`
      WITH scoped_devices AS (
        SELECT
          d.id,
          d.current_owner_type,
          d.current_owner_id,
          d.is_online,
          d.battery_level,
          d.last_sos_at,
          d.assignment_status,
          d.ownership_status,
          d.last_seen_at
        FROM smartwatch_devices d
        LEFT JOIN profiles p ON d.current_owner_type = 'PERSON' AND p.user_id = d.current_owner_id
        LEFT JOIN watch_organizations o ON d.current_owner_type = 'ORGANIZATION' AND o.id = d.current_owner_id
      ),
      agg AS (
        SELECT
          sd.current_owner_type,
          sd.current_owner_id,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE sd.is_online = true)::bigint AS online_count,
          COUNT(*) FILTER (WHERE sd.ownership_status = 'REPLACEMENT_PENDING')::bigint AS replacement_pending_count,
          MAX(sd.last_seen_at) AS last_activity
        FROM scoped_devices sd
        GROUP BY sd.current_owner_type, sd.current_owner_id
      )
      SELECT * FROM agg
      WHERE current_owner_type = ${ownerType}
      ORDER BY total DESC
      LIMIT 51
    `;
    samples.push(performance.now() - started);
  }

  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)] ?? 0;
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0;
  const p99 = samples[Math.floor(samples.length * 0.99)] ?? 0;

  console.log(JSON.stringify({ iterations, p50Ms: p50, p95Ms: p95, p99Ms: p99 }, null, 2));

  const explain = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT
      d.current_owner_type,
      d.current_owner_id,
      COUNT(*) FILTER (WHERE d.is_online = true) AS online_count
    FROM smartwatch_devices d
    WHERE d.current_owner_type = '${ownerType}'
    GROUP BY d.current_owner_type, d.current_owner_id
    LIMIT 51
  `);
  console.log("--- EXPLAIN ANALYZE (representative owner aggregate) ---");
  for (const row of explain as { "QUERY PLAN": string }[]) {
    console.log(row["QUERY PLAN"]);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
