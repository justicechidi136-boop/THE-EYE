import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders, randomCoord, uniqueSuffix } from "./lib/config.js";
import { loginAdmin, loginCitizen, loginSuperAdmin } from "./lib/auth.js";

/**
 * Combined load profile — reduced rates vs individual scenario scripts.
 * Suitable for staging soak tests and baseline capture.
 */
export const options = {
  scenarios: {
    auth_burst: {
      executor: "constant-arrival-rate",
      rate: 3,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 5,
      maxVUs: 12,
      exec: "authBurst",
    },
    incidents: {
      executor: "constant-arrival-rate",
      rate: 2,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 4,
      maxVUs: 10,
      exec: "submitIncident",
      startTime: "5s",
    },
    sos: {
      executor: "constant-arrival-rate",
      rate: 1,
      timeUnit: "1s",
      duration: "45s",
      preAllocatedVUs: 2,
      maxVUs: 6,
      exec: "submitSos",
      startTime: "10s",
    },
    broadcasts: {
      executor: "per-vu-iterations",
      vus: 2,
      iterations: 2,
      maxDuration: "2m",
      exec: "dispatchBroadcast",
      startTime: "15s",
    },
    notifications: {
      executor: "constant-arrival-rate",
      rate: 2,
      timeUnit: "1s",
      duration: "45s",
      preAllocatedVUs: 3,
      maxVUs: 8,
      exec: "pressureNotifications",
      startTime: "20s",
    },
    admin_lists: {
      executor: "constant-arrival-rate",
      rate: 4,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 5,
      maxVUs: 12,
      exec: "listIncidents",
      startTime: "10s",
    },
    gps: {
      executor: "constant-arrival-rate",
      rate: 6,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 8,
      maxVUs: 16,
      exec: "pushGps",
      startTime: "15s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.20"],
    http_req_duration: ["p(95)<3000"],
  },
};

export function setup() {
  const health = http.get(`${config.baseUrl}/health`);
  check(health, { "api reachable": (r) => r.status === 200 });

  const adminToken = loginAdmin();
  const citizenToken = loginCitizen();
  const superAdminToken = loginSuperAdmin();

  let sessionId = null;
  if (citizenToken) {
    const start = http.post(
      `${config.baseUrl}/live-video/incidents/${config.seedIncidentId}/start`,
      JSON.stringify({ latitude: config.latitude, longitude: config.longitude, lowBandwidthMode: true }),
      { headers: jsonHeaders(citizenToken) },
    );
    if (start.status === 200 || start.status === 201) {
      try {
        sessionId = JSON.parse(start.body).data.id;
      } catch {
        sessionId = null;
      }
    }
  }

  return { adminToken, citizenToken, superAdminToken, sessionId };
}

export function authBurst() {
  const isAdmin = __ITER % 2 === 0;
  const payload = isAdmin
    ? { email: config.adminEmail, password: config.password, admin: true }
    : { email: config.citizenEmail, password: config.password, admin: false };
  http.post(`${config.baseUrl}/auth/login`, JSON.stringify(payload), {
    headers: jsonHeaders(),
    tags: { name: "combined_auth_login" },
  });
}

export function submitIncident() {
  http.post(
    `${config.baseUrl}/incidents/report`,
    JSON.stringify({
      type: "Crime",
      description: `combined load ${uniqueSuffix()}`,
      latitude: randomCoord(config.latitude),
      longitude: randomCoord(config.longitude),
      anonymous: true,
    }),
    { headers: jsonHeaders(), tags: { name: "combined_incident_report" } },
  );
}

export function submitSos(data) {
  if (!data.citizenToken) return;
  http.post(
    `${config.baseUrl}/smartwatch/sos`,
    JSON.stringify({
      deviceId: config.watchDeviceId,
      latitude: randomCoord(config.latitude),
      longitude: randomCoord(config.longitude),
      longPressDurationMs: 3000,
      emergencyMode: "NormalSOS",
    }),
    { headers: jsonHeaders(data.citizenToken), tags: { name: "combined_sos" } },
  );
}

export function dispatchBroadcast(data) {
  if (!data.adminToken) return;
  const create = http.post(
    `${config.baseUrl}/broadcasts`,
    JSON.stringify({
      type: "CommunityWarning",
      title: `combined ${uniqueSuffix()}`,
      body: "Combined profile broadcast dispatch",
      priority: "P3SuspiciousActivity",
      jurisdictionId: config.seedJurisdictionId,
      latitude: config.latitude,
      longitude: config.longitude,
      radiusMeters: 2000,
      requiresApproval: false,
    }),
    { headers: jsonHeaders(data.adminToken), tags: { name: "combined_broadcast_create" } },
  );
  if (create.status !== 200 && create.status !== 201) return;
  try {
    const id = JSON.parse(create.body).data.id;
    http.post(`${config.baseUrl}/broadcasts/${id}/dispatch`, null, {
      headers: jsonHeaders(data.adminToken),
      tags: { name: "combined_broadcast_dispatch" },
    });
  } catch {
    // ignore parse errors
  }
}

export function pressureNotifications(data) {
  if (!data.superAdminToken) return;
  http.post(
    `${config.baseUrl}/notifications/send`,
    JSON.stringify({
      userId: config.seedCitizenId,
      type: "EmergencyAlert",
      title: "combined queue test",
      body: "Synthetic notification",
      channels: ["in_app"],
      incidentId: config.seedIncidentId,
    }),
    { headers: jsonHeaders(data.superAdminToken), tags: { name: "combined_notification_send" } },
  );
  if (data.citizenToken) {
    http.get(`${config.baseUrl}/notifications?limit=10`, {
      headers: jsonHeaders(data.citizenToken),
      tags: { name: "combined_notification_list" },
    });
  }
}

export function listIncidents(data) {
  if (!data.adminToken) return;
  http.get(`${config.baseUrl}/incidents?limit=50`, {
    headers: jsonHeaders(data.adminToken),
    tags: { name: "combined_incident_list" },
  });
}

export function pushGps(data) {
  if (!data.citizenToken) return;
  http.post(
    `${config.baseUrl}/smartwatch/devices/${config.watchDeviceId}/gps`,
    JSON.stringify({
      latitude: randomCoord(config.latitude, 0.001),
      longitude: randomCoord(config.longitude, 0.001),
      capturedAt: new Date().toISOString(),
    }),
    { headers: jsonHeaders(data.citizenToken), tags: { name: "combined_smartwatch_gps" } },
  );
  if (data.sessionId) {
    http.post(
      `${config.baseUrl}/live-video/sessions/${data.sessionId}/location`,
      JSON.stringify({
        latitude: randomCoord(config.latitude, 0.001),
        longitude: randomCoord(config.longitude, 0.001),
        capturedAt: new Date().toISOString(),
      }),
      { headers: jsonHeaders(data.citizenToken), tags: { name: "combined_live_video_gps" } },
    );
  }
}

export default function () {
  authBurst();
  sleep(0.1);
}
