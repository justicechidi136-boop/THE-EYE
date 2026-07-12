import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders, randomCoord } from "../lib/config.js";
import { loginCitizen } from "../lib/auth.js";

export const options = {
  scenarios: {
    smartwatch_gps: {
      executor: "constant-arrival-rate",
      rate: 10,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 15,
      maxVUs: 30,
      exec: "smartwatchGps",
    },
    live_video_gps: {
      executor: "constant-arrival-rate",
      rate: 4,
      timeUnit: "1s",
      duration: "90s",
      preAllocatedVUs: 6,
      maxVUs: 12,
      exec: "liveVideoGps",
      startTime: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
    "http_req_duration{name:smartwatch_gps}": ["p(95)<1000"],
    "http_req_duration{name:live_video_location}": ["p(95)<1500"],
  },
};

export function setup() {
  const token = loginCitizen();
  check({ token }, { "citizen token acquired": (d) => Boolean(d.token) });
  if (!token) return { token: null, sessionId: null };

  const startResponse = http.post(
    `${config.baseUrl}/live-video/incidents/${config.seedIncidentId}/start`,
    JSON.stringify({
      latitude: config.latitude,
      longitude: config.longitude,
      lowBandwidthMode: true,
    }),
    { headers: jsonHeaders(token), tags: { name: "live_video_start" } },
  );

  let sessionId = null;
  if (startResponse.status === 200 || startResponse.status === 201) {
    try {
      sessionId = JSON.parse(startResponse.body).data.id;
    } catch {
      sessionId = null;
    }
  }

  return { token, sessionId };
}

export function smartwatchGps(data) {
  if (!data.token) return;

  const payload = {
    latitude: randomCoord(config.latitude, 0.001),
    longitude: randomCoord(config.longitude, 0.001),
    accuracy: 6 + Math.random() * 4,
    speed: Math.random() * 2,
    heading: Math.floor(Math.random() * 360),
    capturedAt: new Date().toISOString(),
    sourceMode: "PairedPhone",
  };

  const response = http.post(
    `${config.baseUrl}/smartwatch/devices/${config.watchDeviceId}/gps`,
    JSON.stringify(payload),
    { headers: jsonHeaders(data.token), tags: { name: "smartwatch_gps" } },
  );

  check(response, {
    "smartwatch gps ok": (r) => [200, 201, 400, 403].includes(r.status),
  });
}

export function liveVideoGps(data) {
  if (!data.token || !data.sessionId) return;

  const payload = {
    latitude: randomCoord(config.latitude, 0.001),
    longitude: randomCoord(config.longitude, 0.001),
    accuracy: 8,
    speed: Math.random(),
    heading: 90,
    capturedAt: new Date().toISOString(),
    sourceDeviceId: config.watchDeviceId,
  };

  const response = http.post(
    `${config.baseUrl}/live-video/sessions/${data.sessionId}/location`,
    JSON.stringify(payload),
    { headers: jsonHeaders(data.token), tags: { name: "live_video_location" } },
  );

  check(response, {
    "live video gps ok": (r) => [200, 201, 400, 403, 404].includes(r.status),
  });
}
