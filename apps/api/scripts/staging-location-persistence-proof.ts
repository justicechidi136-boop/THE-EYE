import { randomUUID } from "node:crypto";
import { IncidentType } from "@the-eye/shared";
import { assertStagingOnlySeedAllowed } from "../prisma/staging-guard";
import {
  readStagingTestCredentials,
  toAccountSpec,
} from "../prisma/staging-test-accounts.config";
import { PrismaClient } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

type ApiResult = {
  ok: boolean;
  status: number;
  requestId?: string;
  body: JsonRecord;
};

function maskRef(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  const canonical = normalizeApiBaseUrl(String(process.env.STAGING_API_BASE_URL ?? "").trim());
  const probeOverride = String(process.env.STAGING_LOGIN_PROBE_BASE_URL ?? "").trim();
  return probeOverride ? normalizeApiBaseUrl(probeOverride) : canonical;
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
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text().catch(() => "");
  let body: JsonRecord = {};
  try {
    body = text ? (JSON.parse(text) as JsonRecord) : {};
  } catch {
    body = { raw: text.slice(0, 240) };
  }

  return {
    ok: response.ok,
    status: response.status,
    requestId: typeof body.requestId === "string" ? body.requestId : undefined,
    body,
  };
}

function logSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function decodeJwtSub(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as JsonRecord;
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  assertStagingOnlySeedAllowed();

  const credentials = readStagingTestCredentials();
  const citizen = credentials.find((entry) => entry.key === "CITIZEN");
  if (!citizen) {
    fail("STAGING_TEST_CITIZEN_* credentials are required.");
  }

  const baseUrl = resolveApiBaseUrl();
  const canonicalUrl = normalizeApiBaseUrl(String(process.env.STAGING_API_BASE_URL ?? "").trim());
  const spec = toAccountSpec(citizen);
  const prisma = new PrismaClient();
  try {
  const runId = randomUUID();
  const clientSubmissionId = `srb039-proof-${runId}`;
  const idempotencyKey = `srb039-${runId}-seq1`;

  logSection("SRB-039 staging location persistence proof");
  console.log(`runId=${runId}`);
  console.log(`apiBase=${baseUrl}${canonicalUrl && canonicalUrl !== baseUrl ? ` canonical=${canonicalUrl}` : ""}`);

  logSection("Phase 5 — citizen authentication");
  const login = await apiRequest(baseUrl, "/v1/auth/login", {
    method: "POST",
    body: { email: spec.email, password: spec.password },
  });
  if (!login.ok || typeof login.body.accessToken !== "string") {
    fail(
      `Citizen login failed http=${login.status}` +
        `${login.requestId ? ` requestId=${login.requestId}` : ""}`,
    );
  }
  const token = login.body.accessToken;
  const user = login.body.user as JsonRecord | undefined;
  const userId = typeof user?.id === "string" ? user.id : decodeJwtSub(token);
  console.log(
    `PASS auth method=password userRef=${userId ? maskRef(userId) : "unknown"}` +
      `${login.requestId ? ` requestId=${login.requestId}` : ""}`,
  );

  logSection("Phase 6 — create controlled incident");
  const incidentPayload = {
    type: IncidentType.Emergency,
    description: "SRB-039 staging QA controlled location persistence proof",
    title: "SRB-039 QA Location Proof",
    latitude: 6.524379,
    longitude: 3.379206,
    accuracyMeters: 12,
    locationStatus: "available",
    locationSource: "mobileGps",
    quality: "precise",
    isCached: false,
    clientSubmissionId,
  };

  const created = await apiRequest(baseUrl, "/v1/incidents/emergency", {
    method: "POST",
    token,
    body: incidentPayload,
    headers: { "x-client-submission-id": clientSubmissionId },
  });
  if (!created.ok) {
    fail(
      `Incident create failed http=${created.status}` +
        `${created.requestId ? ` requestId=${created.requestId}` : ""}`,
    );
  }

  const incidentId =
    typeof created.body.id === "string"
      ? created.body.id
      : typeof (created.body.data as JsonRecord | undefined)?.id === "string"
        ? ((created.body.data as JsonRecord).id as string)
        : undefined;
  if (!incidentId) {
    fail("Incident create response missing id");
  }

  const reporterId =
    typeof created.body.reporterId === "string"
      ? created.body.reporterId
      : typeof (created.body.data as JsonRecord | undefined)?.reporterId === "string"
        ? ((created.body.data as JsonRecord).reporterId as string)
        : userId;
  console.log(
    `PASS incidentId=${incidentId} status=${String(created.body.status ?? "unknown")}` +
      ` reporterRef=${reporterId ? maskRef(reporterId) : "unknown"}` +
      `${created.requestId ? ` requestId=${created.requestId}` : ""}`,
  );

  if (userId && reporterId && userId !== reporterId) {
    fail(`Reporter mismatch: authRef=${maskRef(userId)} incidentRef=${maskRef(reporterId)}`);
  }

  logSection("Phase 6b — direct Prisma create probe");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.incidentLocationUpdate.create({
        data: {
          incidentId,
          latitude: 6.5244,
          longitude: 3.3792,
          capturedAt: new Date(),
          sequenceNumber: -9_999_998,
          metadata: { probe: true, rolledBack: true },
        },
      });
      throw new Error("PROBE_ROLLBACK");
    });
    fail("Direct Prisma create probe did not rollback");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "PROBE_ROLLBACK") {
      console.log("PASS direct Prisma create probe succeeded (rolled back)");
    } else {
      fail(`Direct Prisma create probe failed: ${message.slice(0, 240)}`);
    }
  }

  const locationBase = {
    latitude: 6.524512,
    longitude: 3.379318,
    accuracyMeters: 11,
    capturedAt: new Date().toISOString(),
    source: "mobileGps",
    quality: "precise",
    isCached: false,
  };

  logSection("Phase 7 — immediate persistence (sequence 1)");
  const seq1 = await apiRequest(baseUrl, `/v1/incidents/${incidentId}/location`, {
    method: "POST",
    token,
    body: { ...locationBase, sequenceNumber: 1 },
    headers: { "x-idempotency-key": idempotencyKey },
  });
  if (seq1.status === 202) {
    console.log(
      `WARN seq1 http=202 retryQueued=${String(seq1.body.retryQueued)} retryId=${String(seq1.body.retryId ?? "none")}` +
        `${seq1.requestId ? ` requestId=${seq1.requestId}` : ""}`,
    );
    for (let attempt = 1; attempt <= 12; attempt++) {
      await sleep(2500);
      const dbCount = await prisma.incidentLocationUpdate.count({
        where: { incidentId, sequenceNumber: 1 },
      });
      if (dbCount === 1) {
        console.log(`PASS seq1 recovered via retry worker after ${attempt} poll(s)`);
        break;
      }
      if (attempt === 12) {
        fail(`Sequence 1 returned 202 and retry worker did not persist within 30s`);
      }
    }
  } else if (seq1.status !== 200 && seq1.status !== 201) {
    fail(
      `Sequence 1 POST unexpected http=${seq1.status}` +
        `${seq1.requestId ? ` requestId=${seq1.requestId}` : ""}`,
    );
  } else {
    if (seq1.body.persisted !== true || seq1.body.retryQueued === true) {
      fail(`Sequence 1 response not immediate persistence: ${JSON.stringify(seq1.body)}`);
    }
    console.log(
      `PASS seq1 http=${seq1.status} persisted=true retryQueued=false` +
        `${seq1.requestId ? ` requestId=${seq1.requestId}` : ""}`,
    );
  }

  const dbSeq1Count = await prisma.incidentLocationUpdate.count({
    where: { incidentId, sequenceNumber: 1 },
  });
  if (dbSeq1Count !== 1) {
    fail(`Expected exactly 1 DB row for sequence 1, found ${dbSeq1Count}`);
  }
  console.log(`PASS database row count for sequence 1 = ${dbSeq1Count}`);

  const live1 = await apiRequest(baseUrl, `/v1/incidents/${incidentId}/live-location`, { token });
  if (!live1.ok || live1.body.data == null || live1.body.stale === true) {
    fail(`live-location after seq1 invalid: http=${live1.status} stale=${String(live1.body.stale)}`);
  }
  const liveData = live1.body.data as JsonRecord;
  console.log(
    `PASS live-location sequence=${String(liveData.sequenceNumber ?? "?")} stale=false` +
      `${live1.requestId ? ` requestId=${live1.requestId}` : ""}`,
  );

  const history1 = await apiRequest(baseUrl, `/v1/incidents/${incidentId}/location-history`, { token });
  const historyRows = Array.isArray(history1.body.data) ? history1.body.data : [];
  const hasSeq1 = historyRows.some((row) => (row as JsonRecord).sequenceNumber === 1);
  if (!history1.ok || !hasSeq1) {
    fail("location-history missing sequence 1");
  }
  console.log(`PASS location-history contains sequence 1 (count=${historyRows.length})`);

  logSection("Phase 8 — idempotency (repeat sequence 1)");
  const seq1Dup = await apiRequest(baseUrl, `/v1/incidents/${incidentId}/location`, {
    method: "POST",
    token,
    body: { ...locationBase, sequenceNumber: 1 },
    headers: { "x-idempotency-key": idempotencyKey },
  });
  if (!seq1Dup.ok) {
    fail(`Duplicate sequence 1 failed http=${seq1Dup.status}`);
  }
  const dbSeq1AfterDup = await prisma.incidentLocationUpdate.count({
    where: { incidentId, sequenceNumber: 1 },
  });
  if (dbSeq1AfterDup !== 1) {
    fail(`Duplicate sequence 1 created extra row(s): count=${dbSeq1AfterDup}`);
  }
  console.log(`PASS idempotent duplicate seq1 http=${seq1Dup.status} dbRows=${dbSeq1AfterDup}`);

  logSection("Phase 8 — sequence 2");
  const seq2 = await apiRequest(baseUrl, `/v1/incidents/${incidentId}/location`, {
    method: "POST",
    token,
    body: {
      ...locationBase,
      latitude: 6.52462,
      longitude: 3.37941,
      sequenceNumber: 2,
      capturedAt: new Date(Date.now() + 1000).toISOString(),
    },
  });
  if (!seq2.ok || (seq2.status !== 200 && seq2.status !== 201 && seq2.status !== 202)) {
    fail(`Sequence 2 failed http=${seq2.status}`);
  }
  if (seq2.status === 202) {
    for (let attempt = 1; attempt <= 12; attempt++) {
      await sleep(2500);
      const dbCount = await prisma.incidentLocationUpdate.count({
        where: { incidentId, sequenceNumber: 2 },
      });
      if (dbCount === 1) break;
      if (attempt === 12) fail(`Sequence 2 retry worker did not persist within 30s`);
    }
  } else if (seq2.body.persisted !== true) {
    fail(`Sequence 2 not persisted http=${seq2.status}`);
  }
  const dbSeq2Count = await prisma.incidentLocationUpdate.count({
    where: { incidentId, sequenceNumber: 2 },
  });
  if (dbSeq2Count !== 1) {
    fail(`Expected exactly 1 DB row for sequence 2, found ${dbSeq2Count}`);
  }

  const live2 = await apiRequest(baseUrl, `/v1/incidents/${incidentId}/live-location`, { token });
  const live2Data = live2.body.data as JsonRecord | undefined;
  if (!live2.ok || live2Data?.sequenceNumber !== 2) {
    fail(`live-location did not advance to sequence 2`);
  }
  const history2 = await apiRequest(baseUrl, `/v1/incidents/${incidentId}/location-history`, { token });
  const history2Rows = Array.isArray(history2.body.data) ? history2.body.data : [];
  const sequences = history2Rows.map((row) => (row as JsonRecord).sequenceNumber).sort((a, b) => Number(b) - Number(a));
  if (!sequences.includes(2) || !sequences.includes(1)) {
    fail(`location-history missing sequences after seq2: ${sequences.join(",")}`);
  }
  console.log(
    `PASS seq2 persisted dbRows=${dbSeq2Count} liveSequence=${String(live2Data.sequenceNumber)} history=${sequences.join(",")}`,
  );

  logSection("Phase 9 — controlled 202 retry proof");
  console.log("SKIP — no approved reversible direct-persistence failure injection on staging");

  logSection("Phase 10 — controlled 503 proof");
  console.log("SKIP — no approved retry-queue outage injection on staging");

  logSection("Summary");
  console.log(
    JSON.stringify(
      {
        status: seq1.status === 200 || seq1.status === 201 ? "IMMEDIATE_PERSISTENCE_VERIFIED" : "RETRY_RECOVERED",
        retryProof: "CONTROLLED_RETRY_PENDING",
        incidentId,
        reporterRef: reporterId ? maskRef(reporterId) : undefined,
        dbRows: { sequence1: dbSeq1AfterDup, sequence2: dbSeq2Count },
        liveLocationSequence: live2Data?.sequenceNumber ?? null,
        errInc502: "not_observed",
        locationRetry001: "not_observed",
      },
      null,
      2,
    ),
  );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
