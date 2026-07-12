import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const migrationsDir = join(__dirname, "../../prisma/migrations");

describe("database migrations", () => {
  it("keeps migration directories ordered and populated", () => {
    expect(existsSync(migrationsDir)).toBe(true);
    const migrations = readdirSync(migrationsDir).filter((name) => /^\d{14}_/.test(name)).sort();
    expect(migrations.length).toBeGreaterThanOrEqual(10);
    for (const migration of migrations) {
      expect(existsSync(join(migrationsDir, migration, "migration.sql"))).toBe(true);
    }
  });

  it("enables required geospatial, audit, notification, and smartwatch migrations", () => {
    const sql = readdirSync(migrationsDir)
      .filter((name) => /^\d{14}_/.test(name))
      .map((migration) => readFileSync(join(migrationsDir, migration, "migration.sql"), "utf8"))
      .join("\n");

    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS postgis");
    expect(sql).toContain("prevent_audit_log_mutation");
    expect(sql).toContain("notification_delivery_logs");
    expect(sql).toContain("smartwatch_gps_tracks");
    expect(sql).toContain("live_video_location_updates");
    expect(sql).toContain("idx_incidents_reporter_created_at");
    expect(sql).toContain("idx_notifications_user_unread_created_at");
    expect(sql).toContain("idx_broadcast_deliveries_user_broadcast_id");
  });
});
