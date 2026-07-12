import { ConfigService } from "@nestjs/config";

const DEV_ACCESS_FALLBACK = "dev-access-secret-32-chars-minimum!!";
const DEV_REFRESH_FALLBACK = "dev-refresh-secret-32-chars-minimum!";

function assertProductionSecret(name: string, value: string | undefined) {
  if (process.env.NODE_ENV !== "production") return;
  if (!value || value.length < 24 || value.startsWith("change_me") || value.startsWith("dev")) {
    throw new Error(`${name} must be set to a production secret of at least 24 characters`);
  }
}

export function requireJwtAccessSecret(config: ConfigService): string {
  const secret = config.get<string>("JWT_ACCESS_SECRET");
  assertProductionSecret("JWT_ACCESS_SECRET", secret);
  return secret ?? DEV_ACCESS_FALLBACK;
}

export function requireJwtRefreshSecret(config: ConfigService): string {
  const secret = config.get<string>("JWT_REFRESH_SECRET");
  assertProductionSecret("JWT_REFRESH_SECRET", secret);
  return secret ?? DEV_REFRESH_FALLBACK;
}
