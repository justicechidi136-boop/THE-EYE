import { assertStagingOnlySeedAllowed } from "../prisma/staging-guard";
import {
  normalizeStagingCredentialEmail,
  readStagingTestCredentials,
  toAccountSpec,
  type StagingTestAccountSpec,
} from "../prisma/staging-test-accounts.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type LoginResult = {
  key: string;
  label: string;
  email: string;
  status: "skipped" | "success" | "failed";
  httpStatus?: number;
  userRef?: string;
  requestId?: string;
  detail?: string;
};

function maskRef(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

async function assertCitizenAccountShape(email: string) {
  const normalizedEmail = normalizeStagingCredentialEmail(email);
  const matches = await prisma.user.findMany({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true, email: true, status: true, passwordHash: true },
  });

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one citizen account for ${normalizedEmail}, found ${matches.length}`,
    );
  }

  const user = matches[0]!;
  if (user.status !== "Active") {
    throw new Error(`Citizen account ${maskRef(user.id)} is ${user.status}, expected Active`);
  }
  if (!user.passwordHash) {
    throw new Error(`Citizen account ${maskRef(user.id)} is missing a password hash`);
  }

  return user;
}

async function probeLogin(baseUrl: string, spec: StagingTestAccountSpec): Promise<LoginResult> {
  const endpoint = `${baseUrl}/v1/auth/login`;
  const body = spec.isAdmin
    ? { email: spec.email, password: spec.password, admin: true }
    : { email: spec.email, password: spec.password };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      const text = await response.text().catch(() => "");
      const isCloudflareHtml = text.trimStart().startsWith("<!DOCTYPE") || text.includes("cloudflare");
      let payload: { accessToken?: string; requestId?: string; user?: { id?: string } } = {};
      try {
        payload = text && !isCloudflareHtml ? (JSON.parse(text) as typeof payload) : {};
      } catch {
        payload = {};
      }

      if ((response.status === 502 || response.status === 503) && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }

      if (!response.ok) {
        return {
          key: spec.key,
          label: spec.label,
          email: spec.email,
          status: "failed",
          httpStatus: response.status,
          requestId: payload.requestId,
          detail: isCloudflareHtml
            ? `HTTP ${response.status}: transient gateway HTML`
            : `HTTP ${response.status}${text ? `: ${text.slice(0, 120)}` : ""}`,
        };
      }

      if (!payload.accessToken) {
        return {
          key: spec.key,
          label: spec.label,
          email: spec.email,
          status: "failed",
          httpStatus: response.status,
          requestId: payload.requestId,
          detail: "Login response missing accessToken",
        };
      }

      return {
        key: spec.key,
        label: spec.label,
        email: spec.email,
        status: "success",
        httpStatus: response.status,
        requestId: payload.requestId,
        userRef: payload.user?.id ? maskRef(payload.user.id) : undefined,
      };
    } catch (error) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }
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

  return {
    key: spec.key,
    label: spec.label,
    email: spec.email,
    status: "failed",
    detail: "Login probe exhausted retries",
  };
}

async function main() {
  assertStagingOnlySeedAllowed();

  const credentials = readStagingTestCredentials();
  if (credentials.length === 0) {
    console.log("No STAGING_TEST_* credentials configured — nothing to verify.");
    return;
  }

  const citizen = credentials.find((entry) => entry.key === "CITIZEN");
  if (citizen) {
    const user = await assertCitizenAccountShape(citizen.email);
    console.log(
      `Citizen account ready: email=${citizen.email} userRef=${maskRef(user.id)} status=${user.status}`,
    );
  }

  const baseUrl = String(process.env.STAGING_API_BASE_URL ?? "").trim();
  if (!baseUrl) {
    console.log("STAGING_API_BASE_URL is not set — skipping login probes.");
    for (const entry of credentials) {
      console.log(`- ${entry.key}: ${entry.email} (skipped, API base URL unset)`);
    }
    return;
  }

  if (!citizen) {
    console.error("STAGING_TEST_CITIZEN_* credentials are required when STAGING_API_BASE_URL is set.");
    process.exitCode = 1;
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
      console.log(
        `PASS ${result.label} email=${result.email} http=${result.httpStatus ?? 200}` +
          `${result.userRef ? ` userRef=${result.userRef}` : ""}` +
          `${result.requestId ? ` requestId=${result.requestId}` : ""}`,
      );
      continue;
    }
    failures += 1;
    console.error(
      `FAIL ${result.label} email=${result.email}` +
        `${result.httpStatus ? ` http=${result.httpStatus}` : ""}` +
        `${result.requestId ? ` requestId=${result.requestId}` : ""}` +
        `${result.detail ? ` — ${result.detail}` : ""}`,
    );
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
