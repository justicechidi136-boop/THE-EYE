import { Room } from "livekit-client";
import { randomUUID } from "node:crypto";
import { IncidentType } from "@the-eye/shared";
import { assertStagingOnlySeedAllowed } from "../prisma/staging-guard";
import {
  readStagingTestCredentials,
  toAccountSpec,
} from "../prisma/staging-test-accounts.config";

type JsonRecord = Record<string, unknown>;

const EXPECTED_CLIENT_LIVEKIT_URL = "wss://staging-livekit.theeye.com.ng";
const CONNECT_TIMEOUT_MS = 30000;

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
): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const path = apiPath(baseUrl, pathSuffix);
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

  return { ok: response.ok, status: response.status, body };
}

function extractLivekit(body: JsonRecord): { url?: string; token?: string; roomName?: string } {
  const livekit = body.livekit as JsonRecord | undefined;
  if (!livekit) return {};
  return {
    url: typeof livekit.url === "string" ? livekit.url : undefined,
    token: typeof livekit.token === "string" ? livekit.token : undefined,
    roomName: typeof livekit.roomName === "string" ? livekit.roomName : undefined,
  };
}

async function connectRoom(url: string, token: string): Promise<void> {
  const room = new Room();
  const startedAt = Date.now();
  try {
    await Promise.race([
      room.connect(url, token, { autoSubscribe: false }),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`LiveKit connect timed out after ${CONNECT_TIMEOUT_MS}ms`)),
          CONNECT_TIMEOUT_MS,
        );
      }),
    ]);
    const durationMs = Date.now() - startedAt;
    console.log(
      `PASS livekit room join room=${room.name || "unknown"} durationMs=${durationMs}`,
    );
  } finally {
    await room.disconnect().catch(() => undefined);
  }
}

async function main() {
  assertStagingOnlySeedAllowed();

  const { canonicalUrl, requestUrl } = resolveRequestBaseUrl();
  if (!canonicalUrl.startsWith("https://")) {
    fail("STAGING_API_BASE_URL must be the public HTTPS API base URL.");
  }

  const presetToken = String(process.env.PROOF_TOKEN ?? "").trim();
  const presetIncidentId = String(process.env.PROOF_INCIDENT_ID ?? "").trim();
  let token = presetToken;
  let incidentId = presetIncidentId;

  if (!token || !incidentId) {
    const credentials = readStagingTestCredentials();
    const citizen = credentials.find((entry) => entry.key === "CITIZEN");
    if (!citizen) fail("STAGING_TEST_CITIZEN_* credentials are required.");

    const spec = toAccountSpec(citizen);
    const clientSubmissionId = `live-video-room-proof-${randomUUID()}`;

    const login = await apiRequest(requestUrl, "/auth/login", {
      method: "POST",
      body: { email: spec.email, password: spec.password },
    });
    if (!login.ok || typeof login.body.accessToken !== "string") {
      fail(`login failed http=${login.status}`);
    }
    token = login.body.accessToken;

    const created = await apiRequest(requestUrl, "/incidents/emergency", {
      method: "POST",
      token,
      body: {
        type: IncidentType.Emergency,
        description: "Live emergency video room join proof",
        title: "Live emergency video",
        latitude: 6.5244,
        longitude: 3.3792,
        anonymous: false,
        notifyEmergencyContacts: true,
        capturedAt: new Date().toISOString(),
        clientSubmissionId,
      },
      headers: { "x-client-submission-id": clientSubmissionId },
    });
    if (!created.ok) fail(`emergency create failed http=${created.status}`);
    incidentId =
      typeof created.body.id === "string"
        ? created.body.id
        : typeof (created.body.data as JsonRecord | undefined)?.id === "string"
          ? ((created.body.data as JsonRecord).id as string)
          : "";
    if (!incidentId) fail("emergency create response missing incident id");
  }

  console.log(`=== Staging live video room join proof (stage 5) ===`);
  console.log(`apiBase=${canonicalUrl} incidentId=${incidentId}`);

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
        sourceDeviceId: "room-join-proof",
      },
      headers: {
        "X-Client-Trace-ID": `live-video-room-proof-${randomUUID()}`,
        "X-Request-ID": randomUUID(),
      },
    },
  );

  if (!liveStart.ok) {
    fail(
      `live-video start failed http=${liveStart.status} body=${JSON.stringify(liveStart.body).slice(0, 400)}`,
    );
  }

  const livekit = extractLivekit(liveStart.body);
  if (livekit.url !== EXPECTED_CLIENT_LIVEKIT_URL) {
    fail(`livekit.url=${livekit.url ?? "missing"} expected ${EXPECTED_CLIENT_LIVEKIT_URL}`);
  }
  if (!livekit.token) fail("live-video start response missing livekit.token");

  await connectRoom(livekit.url, livekit.token);
  console.log("=== Staging live video room join proof complete ===");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
