import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders, randomCoord, uniqueSuffix } from "../lib/config.js";
import { loginAdmin, loginCitizen, loginSuperAdmin } from "../lib/auth.js";
import {
  apiLatency,
  broadcastLatency,
  dbLatency,
  liveVideoLatency,
  notificationLatency,
  recordTaggedDuration,
  redisLatency,
  verificationLatency,
} from "../lib/latency-trends.js";
import { buildScaleOptions, resolveScale, scaleLabel } from "../lib/scale-profiles.js";
import { metricsBaseUrl, snapshotPrometheusMetrics } from "../lib/prometheus-snapshot.js";

const scale = resolveScale();
export const options = {
  ...buildScaleOptions(scale),
  tags: { scale: String(scale), profile: "platform-5m" },
};

export function setup() {
  const health = http.get(`${config.baseUrl}/health`, { tags: { name: "api_health" } });
  check(health, { "api reachable": (r) => r.status === 200 });
  recordTaggedDuration(apiLatency, health);

  const ready = http.get(`${config.baseUrl}/health/ready`, { tags: { name: "api_ready" } });
  check(ready, { "ready probe": (r) => r.status === 200 || r.status === 503 });
  recordTaggedDuration(dbLatency, ready);
  recordTaggedDuration(redisLatency, ready);

  const adminToken = loginAdmin();
  const citizenToken = loginCitizen();
  const superAdminToken = loginSuperAdmin();

  let sessionId = null;
  if (citizenToken) {
    const start = http.post(
      `${config.baseUrl}/live-video/incidents/${config.seedIncidentId}/start`,
      JSON.stringify({ latitude: config.latitude, longitude: config.longitude, lowBandwidthMode: true }),
      { headers: jsonHeaders(citizenToken), tags: { name: "live_video_start" } },
    );
    recordTaggedDuration(liveVideoLatency, start);
    if (start.status === 200 || start.status === 201) {
      try {
        sessionId = JSON.parse(start.body).data.id;
      } catch {
        sessionId = null;
      }
    }
  }

  return {
    scale,
    label: scaleLabel(scale),
    adminToken,
    citizenToken,
    superAdminToken,
    sessionId,
    metricsBefore: fetchMetricsSnapshot(),
  };
}

export function teardown(data) {
  const metricsAfter = fetchMetricsSnapshot();
  console.log(`[platform-5m] scale=${data.scale} (${data.label}) completed`);
  if (metricsAfter) {
    console.log(`[prometheus] verification p95=${metricsAfter.verification.p95Ms}ms broadcast p95=${metricsAfter.broadcast.p95Ms}ms`);
  }
  return { metricsAfter };
}

function fetchMetricsSnapshot() {
  const token = __ENV.METRICS_BEARER_TOKEN;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = http.get(metricsBaseUrl(), { headers, tags: { name: "metrics_snapshot" } });
  if (response.status !== 200) return null;
  return snapshotPrometheusMetrics(response.body);
}

export function platformMix(data) {
  const bucket = __ITER % 20;
  if (bucket < 2) return probeDependencies();
  if (bucket < 5) return authLogin();
  if (bucket < 9) return submitIncident();
  if (bucket < 11) return submitSos(data);
  if (bucket < 13) return runVerification(data);
  if (bucket < 15) return dispatchBroadcast(data);
  if (bucket < 17) return pressureNotifications(data);
  if (bucket < 18) return listIncidents(data);
  return pushGpsAndLiveVideo(data);
}

function probeDependencies() {
  const ready = http.get(`${config.baseUrl}/health/ready`, { tags: { name: "dependency_ready" } });
  recordTaggedDuration(dbLatency, ready);
  recordTaggedDuration(redisLatency, ready);
  sleep(0.05);
}

function authLogin() {
  const isAdmin = __VU % 2 === 0;
  const payload = isAdmin
    ? { email: config.adminEmail, password: config.password, admin: true }
    : { email: config.citizenEmail, password: config.password, admin: false };
  const response = http.post(`${config.baseUrl}/auth/login`, JSON.stringify(payload), {
    headers: jsonHeaders(),
    tags: { name: "auth_login" },
  });
  recordTaggedDuration(apiLatency, response);
  sleep(0.1);
}

function submitIncident() {
  const response = http.post(
    `${config.baseUrl}/incidents/report`,
    JSON.stringify({
      type: "Crime",
      description: `scale-${scale} ${uniqueSuffix()}`,
      latitude: randomCoord(config.latitude),
      longitude: randomCoord(config.longitude),
      anonymous: true,
    }),
    { headers: jsonHeaders(), tags: { name: "incident_report" } },
  );
  recordTaggedDuration(apiLatency, response);
  sleep(0.1);
}

function submitSos(data) {
  if (!data.citizenToken) return;
  const response = http.post(
    `${config.baseUrl}/smartwatch/sos`,
    JSON.stringify({
      deviceId: config.watchDeviceId,
      latitude: randomCoord(config.latitude),
      longitude: randomCoord(config.longitude),
      longPressDurationMs: 3000,
      emergencyMode: "NormalSOS",
    }),
    { headers: jsonHeaders(data.citizenToken), tags: { name: "sos_submit" } },
  );
  recordTaggedDuration(apiLatency, response);
  sleep(0.1);
}

function runVerification(data) {
  if (!data.adminToken) return;
  const response = http.post(
    `${config.baseUrl}/verification/incidents/${config.seedIncidentId}/run`,
    JSON.stringify({}),
    { headers: jsonHeaders(data.adminToken), tags: { name: "verification_run" } },
  );
  recordTaggedDuration(verificationLatency, response);
  recordTaggedDuration(apiLatency, response);
  sleep(0.15);
}

function dispatchBroadcast(data) {
  if (!data.adminToken) return;
  const create = http.post(
    `${config.baseUrl}/broadcasts`,
    JSON.stringify({
      type: "CommunityWarning",
      title: `scale-${scale} ${uniqueSuffix()}`,
      body: "Platform 5M broadcast dispatch",
      priority: "P3SuspiciousActivity",
      jurisdictionId: config.seedJurisdictionId,
      latitude: config.latitude,
      longitude: config.longitude,
      radiusMeters: 2000,
      requiresApproval: false,
    }),
    { headers: jsonHeaders(data.adminToken), tags: { name: "broadcast_create" } },
  );
  recordTaggedDuration(apiLatency, create);
  if (create.status !== 200 && create.status !== 201) return;
  try {
    const id = JSON.parse(create.body).data.id;
    const dispatch = http.post(`${config.baseUrl}/broadcasts/${id}/dispatch`, null, {
      headers: jsonHeaders(data.adminToken),
      tags: { name: "broadcast_dispatch" },
    });
    recordTaggedDuration(broadcastLatency, dispatch);
    recordTaggedDuration(apiLatency, dispatch);
  } catch {
    // ignore parse errors
  }
  sleep(0.2);
}

function pressureNotifications(data) {
  if (!data.superAdminToken) return;
  const send = http.post(
    `${config.baseUrl}/notifications/send`,
    JSON.stringify({
      userId: config.seedCitizenId,
      type: "EmergencyAlert",
      title: "scale notification",
      body: "Synthetic notification under load",
      channels: ["in_app"],
      incidentId: config.seedIncidentId,
    }),
    { headers: jsonHeaders(data.superAdminToken), tags: { name: "notification_send" } },
  );
  recordTaggedDuration(notificationLatency, send);
  recordTaggedDuration(apiLatency, send);

  if (data.citizenToken) {
    const list = http.get(`${config.baseUrl}/notifications?limit=10`, {
      headers: jsonHeaders(data.citizenToken),
      tags: { name: "notification_list" },
    });
    recordTaggedDuration(notificationLatency, list);
  }
  sleep(0.1);
}

function listIncidents(data) {
  if (!data.adminToken) return;
  const response = http.get(`${config.baseUrl}/incidents?limit=50`, {
    headers: jsonHeaders(data.adminToken),
    tags: { name: "incident_list" },
  });
  recordTaggedDuration(apiLatency, response);
  sleep(0.05);
}

function pushGpsAndLiveVideo(data) {
  if (!data.citizenToken) return;
  const gps = http.post(
    `${config.baseUrl}/smartwatch/devices/${config.watchDeviceId}/gps`,
    JSON.stringify({
      latitude: randomCoord(config.latitude, 0.001),
      longitude: randomCoord(config.longitude, 0.001),
      capturedAt: new Date().toISOString(),
    }),
    { headers: jsonHeaders(data.citizenToken), tags: { name: "smartwatch_gps" } },
  );
  recordTaggedDuration(apiLatency, gps);

  if (data.sessionId) {
    const location = http.post(
      `${config.baseUrl}/live-video/sessions/${data.sessionId}/location`,
      JSON.stringify({
        latitude: randomCoord(config.latitude, 0.001),
        longitude: randomCoord(config.longitude, 0.001),
        capturedAt: new Date().toISOString(),
      }),
      { headers: jsonHeaders(data.citizenToken), tags: { name: "live_video_location" } },
    );
    recordTaggedDuration(liveVideoLatency, location);
  }
  sleep(0.05);
}

export default function () {
  platformMix({});
}
