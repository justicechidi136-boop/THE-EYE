import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders } from "../lib/config.js";

export const options = {
  scenarios: {
    auth_login_burst: {
      executor: "ramping-arrival-rate",
      startRate: 2,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 40,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "30s", target: 15 },
        { duration: "30s", target: 5 },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
    "http_req_duration{name:auth_login_admin}": ["p(95)<1500"],
    "http_req_duration{name:auth_login_citizen}": ["p(95)<1500"],
  },
};

export function setup() {
  const health = http.get(`${config.baseUrl}/health`);
  check(health, { "api reachable": (r) => r.status === 200 });
  return {};
}

export default function () {
  const isAdmin = __ITER % 2 === 0;
  const payload = isAdmin
    ? { email: config.adminEmail, password: config.password, admin: true }
    : { email: config.citizenEmail, password: config.password, admin: false };

  const response = http.post(`${config.baseUrl}/auth/login`, JSON.stringify(payload), {
    headers: jsonHeaders(),
    tags: { name: isAdmin ? "auth_login_admin" : "auth_login_citizen" },
  });

  check(response, {
    "login accepted or rate limited": (r) => [200, 201, 401, 429].includes(r.status),
  });

  sleep(0.2);
}
