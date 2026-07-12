export const STAGING_TEST_ACCOUNT_KEYS = [
  "SUPER_ADMIN",
  "COUNTRY_ADMIN",
  "STATE_ADMIN",
  "LGA_ADMIN",
  "AGENCY_OFFICER",
  "NEIGHBORHOOD_WATCH_ADMIN",
  "CITIZEN",
  "WATCH_PAIRED_CITIZEN",
] as const;

export type StagingTestAccountKey = (typeof STAGING_TEST_ACCOUNT_KEYS)[number];

export type StagingTestCredentials = {
  key: StagingTestAccountKey;
  email: string;
  password: string;
};

export type StagingTestAccountSpec = StagingTestCredentials & {
  label: string;
  isAdmin: boolean;
  phone?: string;
};

const OPTIONAL_ENV_SUFFIXES = {
  WATCH_PAIRED_CITIZEN: {
    DEVICE_ID: "STAGING_TEST_WATCH_PAIRED_CITIZEN_DEVICE_ID",
    PHONE: "STAGING_TEST_WATCH_PAIRED_CITIZEN_PHONE",
  },
  CITIZEN: {
    PHONE: "STAGING_TEST_CITIZEN_PHONE",
  },
} as const;

export function stagingTestEnvName(key: StagingTestAccountKey, field: "EMAIL" | "PASSWORD"): string {
  return `STAGING_TEST_${key}_${field}`;
}

export function readStagingTestCredentials(
  env: Record<string, string | undefined> = process.env,
): StagingTestCredentials[] {
  const accounts: StagingTestCredentials[] = [];

  for (const key of STAGING_TEST_ACCOUNT_KEYS) {
    const email = String(env[stagingTestEnvName(key, "EMAIL")] ?? "").trim();
    const password = String(env[stagingTestEnvName(key, "PASSWORD")] ?? "").trim();
    if (!email || !password) continue;
    accounts.push({ key, email, password });
  }

  return accounts;
}

export function requireStagingTestCredentials(
  env: Record<string, string | undefined> = process.env,
): StagingTestCredentials[] {
  const accounts = readStagingTestCredentials(env);
  if (accounts.length === 0) {
    throw new Error(
      "No staging test credentials found. Set STAGING_TEST_<ROLE>_EMAIL and STAGING_TEST_<ROLE>_PASSWORD " +
        "for at least one account (see apps/api/.env.staging.example).",
    );
  }
  return accounts;
}

export function toAccountSpec(
  credentials: StagingTestCredentials,
  env: Record<string, string | undefined> = process.env,
): StagingTestAccountSpec {
  const adminKeys = new Set<StagingTestAccountKey>([
    "SUPER_ADMIN",
    "COUNTRY_ADMIN",
    "STATE_ADMIN",
    "LGA_ADMIN",
    "AGENCY_OFFICER",
    "NEIGHBORHOOD_WATCH_ADMIN",
  ]);

  const labels: Record<StagingTestAccountKey, string> = {
    SUPER_ADMIN: "Super Admin",
    COUNTRY_ADMIN: "Country Admin",
    STATE_ADMIN: "State Admin",
    LGA_ADMIN: "LGA Admin",
    AGENCY_OFFICER: "Agency Officer",
    NEIGHBORHOOD_WATCH_ADMIN: "Neighborhood Watch Admin",
    CITIZEN: "Citizen",
    WATCH_PAIRED_CITIZEN: "Watch-paired Citizen",
  };

  const spec: StagingTestAccountSpec = {
    ...credentials,
    label: labels[credentials.key],
    isAdmin: adminKeys.has(credentials.key),
  };

  if (credentials.key === "CITIZEN") {
    const phone = String(envOptional(OPTIONAL_ENV_SUFFIXES.CITIZEN.PHONE, env) ?? "").trim();
    if (phone) spec.phone = phone;
  }

  if (credentials.key === "WATCH_PAIRED_CITIZEN") {
    const phone = String(envOptional(OPTIONAL_ENV_SUFFIXES.WATCH_PAIRED_CITIZEN.PHONE, env) ?? "").trim();
    if (phone) spec.phone = phone;
  }

  return spec;
}

function envOptional(name: string, env: Record<string, string | undefined>): string | undefined {
  const value = String(env[name] ?? "").trim();
  return value || undefined;
}

export function readWatchDeviceId(env: Record<string, string | undefined> = process.env): string {
  return (
    String(env[OPTIONAL_ENV_SUFFIXES.WATCH_PAIRED_CITIZEN.DEVICE_ID] ?? "").trim() ||
    "staging-watch-paired-001"
  );
}
