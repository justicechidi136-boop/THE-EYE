#!/usr/bin/env tsx
/**
 * Seeds an isolated performance database for watch fleet benchmarks.
 * NEVER run against production or shared staging.
 *
 * Usage:
 *   WATCH_FLEET_BENCH_DEVICE_COUNT=1000000 \
 *   WATCH_FLEET_BENCH_OWNER_ID=<uuid> \
 *   DATABASE_URL=postgres://perf... \
 *   tsx scripts/watch-fleet-performance/seed-million-devices.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const DEVICE_COUNT = Number(process.env.WATCH_FLEET_BENCH_DEVICE_COUNT ?? 1_000_000);
const BATCH_SIZE = Number(process.env.WATCH_FLEET_BENCH_BATCH_SIZE ?? 5_000);
const OWNER_ID = process.env.WATCH_FLEET_BENCH_OWNER_ID ?? randomUUID();
const OWNER_TYPE = process.env.WATCH_FLEET_BENCH_OWNER_TYPE ?? "PERSON";

const OWNERSHIP_STATUSES = [
  "ASSIGNED",
  "ASSIGNED",
  "ASSIGNED",
  "REPLACEMENT_PENDING",
  "LOST_OR_STOLEN",
  "RETIRED",
] as const;

const FIRMWARE_VERSIONS = ["1.0.0", "1.1.0", "1.2.3", "2.0.0-beta"];

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

async function seedBatch(offset: number, size: number) {
  const rows = Array.from({ length: size }, (_, i) => {
    const n = offset + i;
    const online = n % 3 !== 0;
    const battery = (n % 100) + 1;
    const ownershipStatus = pick(OWNERSHIP_STATUSES, n);
    const lastSeenHoursAgo = n % 720;
    const lastSeenAt = new Date(Date.now() - lastSeenHoursAgo * 60 * 60 * 1000);
    const lastSosAt = n % 50 === 0 ? new Date(Date.now() - (n % 48) * 60 * 60 * 1000) : null;

    return {
      deviceId: `bench-device-${n}`,
      serialNumber: `SN-BENCH-${n}`,
      imei: `3567890${String(n).padStart(8, "0")}`,
      provider: "THE_EYE",
      connectivityMode: "Standalone",
      preferredMode: "Standalone",
      currentOwnerType: OWNER_TYPE,
      currentOwnerId: OWNER_ID,
      ownershipStatus,
      inventoryStatus: ownershipStatus === "ASSIGNED" ? "DEPLOYED" : "IN_STOCK",
      assignmentStatus: ownershipStatus === "ASSIGNED" ? "ACTIVE" : "UNASSIGNED",
      isOnline: online,
      batteryLevel: battery,
      firmwareVersion: pick(FIRMWARE_VERSIONS, n),
      lastSeenAt,
      lastSosAt,
      lastKnownState: "Lagos",
      lastKnownLga: n % 2 === 0 ? "Ikeja" : "Eti-Osa",
    };
  });

  await prisma.smartwatchDevice.createMany({ data: rows, skipDuplicates: true });
}

async function main() {
  console.log(JSON.stringify({ event: "seed_start", deviceCount: DEVICE_COUNT, ownerId: OWNER_ID, ownerType: OWNER_TYPE }));

  const started = performance.now();
  for (let offset = 0; offset < DEVICE_COUNT; offset += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, DEVICE_COUNT - offset);
    await seedBatch(offset, size);
    if (offset % (BATCH_SIZE * 10) === 0) {
      console.log(JSON.stringify({ event: "seed_progress", inserted: offset + size, total: DEVICE_COUNT }));
    }
  }

  const count = await prisma.smartwatchDevice.count({
    where: { currentOwnerId: OWNER_ID, currentOwnerType: OWNER_TYPE },
  });

  console.log(
    JSON.stringify({
      event: "seed_complete",
      durationSeconds: (performance.now() - started) / 1000,
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      deviceCount: count,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
