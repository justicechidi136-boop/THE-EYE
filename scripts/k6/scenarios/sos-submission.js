import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders, randomCoord } from "../lib/config.js";
import { loginCitizen } from "../lib/auth.js";

export const options = {
  scenarios: {
    sos_submission: {
      executor: "constant-arrival-rate",
      rate: 2,
      timeUnit: "1s",
      duration: "90s",
      preAllocatedVUs: 5,
      maxVUs: 15,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.20"],
    "http_req_duration{name:sos_submit}": ["p(95)<3500"],
  },
};

export function setup() {
  const token = loginCitizen();
  check({ token }, { "citizen token acquired": (d) => Boolean(d.token) });
  return { token };
}

export default function sosSubmission(data) {
  if (!data.token) return;

  const payload = {
    deviceId: config.watchDeviceId,
    latitude: randomCoord(config.latitude),
    longitude: randomCoord(config.longitude),
    description: "k6 SOS load test",
    emergencyMode: "NormalSOS",
    longPressDurationMs: 3000,
    sourceMode: "PairedPhone",
    accuracy: 8,
    batteryLevel: 80,
  };

  const response = http.post(`${config.baseUrl}/smartwatch/sos`, JSON.stringify(payload), {
    headers: jsonHeaders(data.token),
    tags: { name: "sos_submit" },
  });

  check(response, {
    "sos accepted or limited": (r) => [200, 201, 400, 403, 429].includes(r.status),
  });

  sleep(1);
}
