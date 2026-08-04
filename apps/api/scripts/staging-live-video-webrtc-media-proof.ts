/**
 * Stage 6 — full WebRTC media proof (PeerConnection / ICE / DTLS).
 *
 * Stage 5 (`staging-live-video-room-join-proof.ts`) only opens WSS and closes;
 * it does NOT wait for EnginePeerStateUpdatedEvent / ICE connected.
 *
 * Run from OUTSIDE the VPS (developer laptop, GitHub Actions ubuntu runner):
 *   set STAGING_API_BASE_URL=https://staging-api.theeye.com.ng/v1
 *   set STAGING_TEST_CITIZEN_EMAIL=...
 *   set STAGING_TEST_CITIZEN_PASSWORD=...
 *   pnpm --filter @the-eye/api exec tsx scripts/staging-live-video-webrtc-media-proof.ts
 *
 * Requires devDependencies: livekit-client, @livekit/rtc-node
 */
import { randomUUID } from "node:crypto";
import { ConnectionState, Room, RoomEvent } from "@livekit/rtc-node";
import { IncidentType } from "@the-eye/shared";
import { assertStagingOnlySeedAllowed } from "../prisma/staging-guard";
import {
  readStagingTestCredentials,
  toAccountSpec,
} from "../prisma/staging-test-accounts.config";

type JsonRecord = Record<string, unknown>;

const EXPECTED_CLIENT_LIVEKIT_URL = "wss://staging-livekit.theeye.com.ng";
const CONNECT_TIMEOUT_MS = 35_000;

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
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
    signal: AbortSignal.timeout(20_000),
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

function extractLivekit(body: JsonRecord): { url?: string; token?: string } {
  const livekit = body.livekit as JsonRecord | undefined;
  if (!livekit) return {};
  return {
    url: typeof livekit.url === "string" ? livekit.url : undefined,
    token: typeof livekit.token === "string" ? livekit.token : undefined,
  };
}

async function connectWithFullWebRtc(url: string, token: string): Promise<void> {
  const room = new Room();
  const states: string[] = [];

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    states.push(String(state));
    console.log(`INFO room.connectionState=${state}`);
  });
  room.on(RoomEvent.Connected, () => {
    console.log("PASS LiveKit room connected (PeerConnection / ICE established)");
  });
  room.on(RoomEvent.Disconnected, (reason) => {
    console.log(`WARN room disconnected reason=${String(reason)}`);
  });

  const startedAt = Date.now();
  try {
    await room.connect(url, token, { autoSubscribe: false, dynacast: false });
    const durationMs = Date.now() - startedAt;
    if (room.connectionState !== ConnectionState.CONN_CONNECTED) {
      fail(
        `room.connect resolved but state=${room.connectionState} (history=${states.join("->")}) durationMs=${durationMs}`,
      );
    }
    console.log(
      `PASS stage 6 WebRTC media connected durationMs=${durationMs} stateHistory=${states.join("->")}`,
    );
  } finally {
    await room.disconnect().catch(() => undefined);
  }
}

async function main() {
  assertStagingOnlySeedAllowed();
  console.log("INFO @livekit/rtc-node Room SDK loaded for Node WebRTC");

  const apiBase = normalizeApiBaseUrl(String(process.env.STAGING_API_BASE_URL ?? "").trim());
  if (!apiBase.startsWith("https://")) {
    fail("STAGING_API_BASE_URL must be the public HTTPS API base URL.");
  }

  const presetToken = String(process.env.PROOF_TOKEN ?? "").trim();
  const presetIncidentId = String(process.env.PROOF_INCIDENT_ID ?? "").trim();
  const presetLivekitUrl = String(process.env.PROOF_LIVEKIT_URL ?? "").trim();
  const presetLivekitToken = String(process.env.PROOF_LIVEKIT_TOKEN ?? "").trim();

  if (presetLivekitUrl && presetLivekitToken) {
    console.log(`=== Staging live video WebRTC media proof (stage 6) ===`);
    console.log(`livekitUrl=${presetLivekitUrl} (token supplied via PROOF_LIVEKIT_TOKEN)`);
    console.log(
      "NOTE run this script from OUTSIDE the VPS — stage 5 on-VPS does not prove external ICE.",
    );
    await connectWithFullWebRtc(presetLivekitUrl, presetLivekitToken);
    console.log("=== Staging live video WebRTC media proof complete ===");
    return;
  }

  let token = presetToken;
  let incidentId = presetIncidentId;

  if (!token || !incidentId) {
    const credentials = readStagingTestCredentials();
    const citizen = credentials.find((entry) => entry.key === "CITIZEN");
    if (!citizen) fail("STAGING_TEST_CITIZEN_* credentials are required.");

    const spec = toAccountSpec(citizen);
    const clientSubmissionId = `live-video-webrtc-proof-${randomUUID()}`;

    const login = await apiRequest(apiBase, "/auth/login", {
      method: "POST",
      body: { email: spec.email, password: spec.password },
    });
    if (!login.ok || typeof login.body.accessToken !== "string") {
      fail(`login failed http=${login.status}`);
    }
    token = login.body.accessToken;

    const created = await apiRequest(apiBase, "/incidents/emergency", {
      method: "POST",
      token,
      body: {
        type: IncidentType.Emergency,
        description: "Live emergency video WebRTC media proof",
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

  console.log(`=== Staging live video WebRTC media proof (stage 6) ===`);
  console.log(`apiBase=${apiBase} incidentId=${incidentId}`);
  console.log(
    "NOTE run this script from OUTSIDE the VPS — stage 5 on-VPS does not prove external ICE.",
  );

  const liveStart = await apiRequest(apiBase, `/live-video/incidents/${incidentId}/start`, {
    method: "POST",
    token,
    body: {
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 12,
      capturedAt: new Date().toISOString(),
      lowBandwidthMode: true,
      sourceDeviceId: "webrtc-media-proof",
    },
    headers: {
      "X-Client-Trace-ID": `live-video-webrtc-proof-${randomUUID()}`,
      "X-Request-ID": randomUUID(),
    },
  });

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

  await connectWithFullWebRtc(livekit.url, livekit.token);
  console.log("=== Staging live video WebRTC media proof complete ===");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
