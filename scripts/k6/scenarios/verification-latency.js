import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders } from "../lib/config.js";
import { loginAdmin } from "../lib/auth.js";
import { apiLatency, recordTaggedDuration, verificationLatency } from "../lib/latency-trends.js";

/**
 * Focused verification latency scenario — admin-triggered scoring runs.
 */
export const options = {
  scenarios: {
    verification_ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "2m", target: Number(__ENV.VERIFICATION_VUS || 20) },
        { duration: "30s", target: 0 },
      ],
      exec: "runVerification",
    },
  },
  thresholds: {
    verification_latency: ["p(95)<5000"],
    http_req_failed: ["rate<0.15"],
  },
};

export function setup() {
  const adminToken = loginAdmin();
  check(adminToken, { "admin token": (t) => Boolean(t) });
  return { adminToken };
}

export function runVerification(data) {
  if (!data.adminToken) return;
  const response = http.post(
    `${config.baseUrl}/verification/incidents/${config.seedIncidentId}/run`,
    JSON.stringify({}),
    { headers: jsonHeaders(data.adminToken), tags: { name: "verification_run" } },
  );
  check(response, {
    "verification accepted": (r) => [200, 201, 429].includes(r.status),
  });
  recordTaggedDuration(verificationLatency, response);
  recordTaggedDuration(apiLatency, response);
  sleep(0.2);
}

export default function () {
  runVerification({ adminToken: loginAdmin() });
}
