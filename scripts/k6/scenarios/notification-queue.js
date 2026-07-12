import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders } from "../lib/config.js";
import { loginCitizen, loginSuperAdmin } from "../lib/auth.js";

export const options = {
  scenarios: {
    notification_enqueue: {
      executor: "constant-arrival-rate",
      rate: 4,
      timeUnit: "1s",
      duration: "90s",
      preAllocatedVUs: 5,
      maxVUs: 12,
      exec: "enqueueNotifications",
    },
    notification_list: {
      executor: "constant-arrival-rate",
      rate: 6,
      timeUnit: "1s",
      duration: "90s",
      preAllocatedVUs: 8,
      maxVUs: 20,
      exec: "listNotifications",
      startTime: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.15"],
    "http_req_duration{name:notification_send}": ["p(95)<3000"],
    "http_req_duration{name:notification_list}": ["p(95)<1500"],
  },
};

export function setup() {
  const adminToken = loginSuperAdmin();
  const citizenToken = loginCitizen();
  check({ adminToken, citizenToken }, {
    "admin token acquired": (d) => Boolean(d.adminToken),
    "citizen token acquired": (d) => Boolean(d.citizenToken),
  });
  return { adminToken, citizenToken };
}

export function enqueueNotifications(data) {
  if (!data.adminToken) return;

  const payload = {
    userId: config.seedCitizenId,
    type: "EmergencyAlert",
    title: "k6 queue pressure test",
    body: "Synthetic notification for BullMQ load testing.",
    priority: "High",
    channels: ["in_app", "push"],
    incidentId: config.seedIncidentId,
    latitude: config.latitude,
    longitude: config.longitude,
    radiusMeters: 3000,
  };

  const response = http.post(`${config.baseUrl}/notifications/send`, JSON.stringify(payload), {
    headers: jsonHeaders(data.adminToken),
    tags: { name: "notification_send" },
  });

  check(response, {
    "notification enqueued": (r) => [200, 201, 400, 429].includes(r.status),
  });

  sleep(0.3);
}

export function listNotifications(data) {
  if (!data.citizenToken) return;

  const response = http.get(`${config.baseUrl}/notifications?limit=25`, {
    headers: jsonHeaders(data.citizenToken),
    tags: { name: "notification_list" },
  });

  check(response, {
    "notification list ok": (r) => r.status === 200,
    "notification page shape": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data);
      } catch {
        return false;
      }
    },
  });

  sleep(0.2);
}
