import { randomUUID } from "node:crypto";
import { IncidentType } from "@the-eye/shared";
import { assertStagingOnlySeedAllowed } from "../prisma/staging-guard";
import {
  readStagingTestCredentials,
  toAccountSpec,
} from "../prisma/staging-test-accounts.config";

type JsonRecord = Record<string, unknown>;

type ApiResult = {
  ok: boolean;
  status: number;
  requestId?: string;
  body: JsonRecord;
};

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function apiRequest(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`fetch failed for ${path}: ${message}`);
  }

  const text = await response.text().catch(() => "");
  let body: JsonRecord = {};
  try {
    body = text ? (JSON.parse(text) as JsonRecord) : {};
  } catch {
    body = { raw: text.slice(0, 400) };
  }

  return {
    ok: response.ok,
    status: response.status,
    requestId: typeof body.requestId === "string" ? body.requestId : undefined,
    body,
  };
}

async function main() {
  assertStagingOnlySeedAllowed();

  const baseUrl = normalizeApiBaseUrl(String(process.env.STAGING_API_BASE_URL ?? "").trim());
  if (!baseUrl.startsWith("https://")) {
    fail("STAGING_API_BASE_URL must be the public HTTPS API base URL.");
  }

  const credentials = readStagingTestCredentials();
  const citizen = credentials.find((entry) => entry.key === "CITIZEN");
  if (!citizen) {
    fail("STAGING_TEST_CITIZEN_* credentials are required.");
  }

  const spec = toAccountSpec(citizen);
  const clientSubmissionId = `live-video-proof-${randomUUID()}`;

  console.log(`=== Staging live video public proof ===`);
  console.log(`apiBase=${baseUrl}`);

  const login = await apiRequest(baseUrl, "/v1/auth/login", {
    method: "POST",
    body: { email: spec.email, password: spec.password },
  });
  if (!login.ok || typeof login.body.accessToken !== "string") {
    fail(
      `login failed http=${login.status}` +
        `${login.requestId ? ` requestId=${login.requestId}` : ""}`,
    );
  }
  const token = login.body.accessToken;
  console.log(`PASS login http=${login.status}`);

  const emergencyPayload = {
    type: IncidentType.Emergency,
    description: "Live emergency video started with GPS.",
    title: "Live emergency video",
    latitude: 6.5244,
    longitude: 3.3792,
    anonymous: false,
    notifyEmergencyContacts: true,
    capturedAt: new Date().toISOString(),
    clientSubmissionId,
  };

  const created = await apiRequest(baseUrl, "/v1/incidents/emergency", {
    method: "POST",
    token,
    body: emergencyPayload,
    headers: { "x-client-submission-id": clientSubmissionId },
  });
  if (!created.ok) {
    fail(
      `emergency create failed http=${created.status}` +
        `${created.requestId ? ` requestId=${created.requestId}` : ""}` +
        ` body=${JSON.stringify(created.body).slice(0, 240)}`,
    );
  }

  const incidentId =
    typeof created.body.id === "string"
      ? created.body.id
      : typeof (created.body.data as JsonRecord | undefined)?.id === "string"
        ? ((created.body.data as JsonRecord).id as string)
        : undefined;
  if (!incidentId) {
    fail("emergency create response missing incident id");
  }
  console.log(
    `PASS emergency http=${created.status} incidentId=${incidentId}` +
      `${created.requestId ? ` requestId=${created.requestId}` : ""}`,
  );

  const liveStart = await apiRequest(baseUrl, `/v1/live-video/incidents/${incidentId}/start`, {
    method: "POST",
    token,
    body: {
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 12,
      capturedAt: new Date().toISOString(),
      lowBandwidthMode: true,
      sourceDeviceId: "mobile-primary",
    },
  });
  if (!liveStart.ok) {
    fail(
      `live-video start failed http=${liveStart.status}` +
        `${liveStart.requestId ? ` requestId=${liveStart.requestId}` : ""}` +
        ` body=${JSON.stringify(liveStart.body).slice(0, 400)}`,
    );
  }

  const sessionId =
    typeof (liveStart.body.data as JsonRecord | undefined)?.id === "string"
      ? ((liveStart.body.data as JsonRecord).id as string)
      : undefined;
  console.log(
    `PASS live-video start http=${liveStart.status} sessionId=${sessionId ?? "unknown"}` +
      `${liveStart.requestId ? ` requestId=${liveStart.requestId}` : ""}`,
  );
  console.log("=== Staging live video public proof complete ===");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
