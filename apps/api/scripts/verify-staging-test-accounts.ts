import { assertStagingOnlySeedAllowed } from "../prisma/staging-guard";
import {
  readStagingTestCredentials,
  toAccountSpec,
  type StagingTestAccountSpec,
} from "../prisma/staging-test-accounts.config";

type LoginResult = {
  key: string;
  label: string;
  email: string;
  status: "skipped" | "success" | "failed";
  detail?: string;
};

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

async function probeLogin(baseUrl: string, spec: StagingTestAccountSpec): Promise<LoginResult> {
  const endpoint = `${baseUrl}/v1/auth/login`;
  const body = spec.isAdmin
    ? { email: spec.email, password: spec.password, admin: true }
    : { email: spec.email, password: spec.password };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        key: spec.key,
        label: spec.label,
        email: spec.email,
        status: "failed",
        detail: `HTTP ${response.status}${text ? `: ${text.slice(0, 120)}` : ""}`,
      };
    }

    const payload = (await response.json()) as { accessToken?: string };
    if (!payload.accessToken) {
      return {
        key: spec.key,
        label: spec.label,
        email: spec.email,
        status: "failed",
        detail: "Login response missing accessToken",
      };
    }

    return { key: spec.key, label: spec.label, email: spec.email, status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      key: spec.key,
      label: spec.label,
      email: spec.email,
      status: "failed",
      detail: message,
    };
  }
}

async function main() {
  assertStagingOnlySeedAllowed();

  const credentials = readStagingTestCredentials();
  if (credentials.length === 0) {
    console.log("No STAGING_TEST_* credentials configured — nothing to verify.");
    return;
  }

  const baseUrl = String(process.env.STAGING_API_BASE_URL ?? "").trim();
  if (!baseUrl) {
    console.log("STAGING_API_BASE_URL is not set — skipping login probes.");
    for (const entry of credentials) {
      console.log(`- ${entry.key}: ${entry.email} (skipped, API base URL unset)`);
    }
    return;
  }

  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  console.log(`Probing ${credentials.length} staging account(s) against ${normalizedBaseUrl} ...`);

  const results: LoginResult[] = [];
  for (const entry of credentials) {
    results.push(await probeLogin(normalizedBaseUrl, toAccountSpec(entry)));
  }

  let failures = 0;
  for (const result of results) {
    if (result.status === "success") {
      console.log(`PASS ${result.label} (${result.email})`);
      continue;
    }
    failures += 1;
    console.error(`FAIL ${result.label} (${result.email})${result.detail ? ` — ${result.detail}` : ""}`);
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
