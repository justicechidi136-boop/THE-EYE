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
  durationMs: number;
};

const EXPECTED_CLIENT_LIVEKIT_URL = "wss://staging-livekit.theeye.com.ng";
const PUBLIC_START_ATTEMPTS = 5;

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveRequestBaseUrl(): { canonicalUrl: string; requestUrl: string } {
  const canonicalUrl = normalizeApiBaseUrl(String(process.env.STAGING_API_BASE_URL ?? "").trim());
  const probeOverride = String(process.env.STAGING_API_PROBE_BASE_URL ?? "").trim();
  const requestUrl = probeOverride ? normalizeApiBaseUrl(probeOverride) : canonicalUrl;
  return { canonicalUrl, requestUrl };
}

function apiPath(baseUrl: string, suffix: string): string {
  const normalized = normalizeApiBaseUrl(baseUrl);
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  if (normalized.endsWith("/v1")) {
    return path.startsWith("/v1/") ? path.replace(/^\/v1/, "") : path;
  }
  return path.startsWith("/v1/") ? path : `/v1${path}`;
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function apiRequest(
  baseUrl: string,
  pathSuffix: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResult> {
  const path = apiPath(baseUrl, pathSuffix);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${normalizeApiBaseUrl(baseUrl)}${path}`, {
        method: options.method ?? "GET",
        headers: {
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
          ...(options.body ? { "content-type": "application/json" } : {}),
          ...(options.headers ?? {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(20000),
      });

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
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  fail(`fetch failed for ${path}: ${message}`);
}

function extractLivekitUrl(body: JsonRecord): string | undefined {
  const livekit = body.livekit as JsonRecord | undefined;
  if (livekit && typeof livekit.url === "string") return livekit.url;
  const data = body.data as JsonRecord | undefined;
  const nested = data?.livekit as JsonRecord | undefined;
  if (nested && typeof nested.url === "string") return nested.url;
  return undefined;
}

function assertPublicLivekitUrl(url: string | undefined, context: string) {
  if (!url) fail(`${context}: response missing livekit.url`);
  if (url !== EXPECTED_CLIENT_LIVEKIT_URL) {
    fail(`${context}: livekit.url=${url} expected ${EXPECTED_CLIENT_LIVEKIT_URL}`);
  }
  for (const forbidden of ["ws://livekit", "localhost", "127.0.0.1", "production"]) {
    if (url.includes(forbidden)) {
      fail(`${context}: forbidden LiveKit URL fragment in ${url}`);
    }
  }
}

async function main() {
  assertStagingOnlySeedAllowed();

  const { canonicalUrl, requestUrl } = resolveRequestBaseUrl();
  if (!canonicalUrl.startsWith("https://")) {
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
  console.log(`apiBase=${canonicalUrl} authBase=${requestUrl} publicStartBase=${canonicalUrl}`);

  const login = await apiRequest(requestUrl, "/auth/login", {
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
  console.log(`PASS login http=${login.status} durationMs=${login.durationMs}`);

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

  const created = await apiRequest(requestUrl, "/incidents/emergency", {
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
      `${created.requestId ? ` requestId=${created.requestId}` : ""}` +
      ` durationMs=${created.durationMs}`,
  );

  let successCount = 0;
  for (let attempt = 1; attempt <= PUBLIC_START_ATTEMPTS; attempt++) {
    const clientTraceId = `live-video-proof-${attempt}-${randomUUID()}`;
    const liveStart = await apiRequest(
      canonicalUrl,
      `/live-video/incidents/${incidentId}/start`,
      {
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
        headers: {
          "X-Client-Trace-ID": clientTraceId,
          "X-Request-ID": randomUUID(),
        },
      },
    );

    if (liveStart.status === 502 || liveStart.status === 503) {
      fail(
        `live-video start attempt ${attempt}/${PUBLIC_START_ATTEMPTS} gateway http=${liveStart.status}` +
          `${liveStart.requestId ? ` requestId=${liveStart.requestId}` : ""}`,
      );
    }
    if (!liveStart.ok) {
      fail(
        `live-video start attempt ${attempt}/${PUBLIC_START_ATTEMPTS} http=${liveStart.status}` +
          `${liveStart.requestId ? ` requestId=${liveStart.requestId}` : ""}` +
          ` body=${JSON.stringify(liveStart.body).slice(0, 400)}`,
      );
    }

    const livekitUrl = extractLivekitUrl(liveStart.body);
    assertPublicLivekitUrl(livekitUrl, `attempt ${attempt}`);

    const sessionId =
      typeof (liveStart.body.data as JsonRecord | undefined)?.id === "string"
        ? ((liveStart.body.data as JsonRecord).id as string)
        : undefined;
    const roomName =
      typeof liveStart.body.livekit === "object" &&
      liveStart.body.livekit &&
      typeof (liveStart.body.livekit as JsonRecord).roomName === "string"
        ? ((liveStart.body.livekit as JsonRecord).roomName as string)
        : undefined;
    const hasToken =
      typeof liveStart.body.livekit === "object" &&
      liveStart.body.livekit &&
      typeof (liveStart.body.livekit as JsonRecord).token === "string";

    console.log(
      `PASS public live-video start ${attempt}/${PUBLIC_START_ATTEMPTS} http=${liveStart.status}` +
        ` sessionId=${sessionId ?? "unknown"} room=${roomName ?? "unknown"}` +
        ` livekitUrl=${livekitUrl}` +
        ` tokenPresent=${hasToken ? "yes" : "no"}` +
        `${liveStart.requestId ? ` requestId=${liveStart.requestId}` : ""}` +
        ` clientTraceId=${clientTraceId}` +
        ` durationMs=${liveStart.durationMs}`,
    );
    successCount++;
  }

  console.log(`PASS public stage4 ${successCount}/${PUBLIC_START_ATTEMPTS} livekitUrl=${EXPECTED_CLIENT_LIVEKIT_URL}`);
  console.log("=== Staging live video public proof complete ===");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
