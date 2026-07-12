import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders, uniqueSuffix } from "../lib/config.js";
import { loginAdmin } from "../lib/auth.js";

export const options = {
  scenarios: {
    broadcast_dispatch: {
      executor: "per-vu-iterations",
      vus: 3,
      iterations: 5,
      maxDuration: "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.15"],
    "http_req_duration{name:broadcast_create}": ["p(95)<2500"],
    "http_req_duration{name:broadcast_dispatch}": ["p(95)<5000"],
  },
};

export function setup() {
  const token = loginAdmin();
  check({ token }, { "admin token acquired": (d) => Boolean(d.token) });
  return { token };
}

export default function broadcastDispatch(data) {
  if (!data.token) return;

  const createPayload = {
    type: "CommunityWarning",
    title: `k6 broadcast ${uniqueSuffix()}`,
    body: "Load test safety notice for Allen Avenue corridor.",
    priority: "P3SuspiciousActivity",
    jurisdictionId: config.seedJurisdictionId,
    latitude: config.latitude,
    longitude: config.longitude,
    radiusMeters: 2500,
    requiresApproval: false,
  };

  const createResponse = http.post(`${config.baseUrl}/broadcasts`, JSON.stringify(createPayload), {
    headers: jsonHeaders(data.token),
    tags: { name: "broadcast_create" },
  });

  const created = check(createResponse, {
    "broadcast created": (r) => r.status === 200 || r.status === 201,
  });

  if (!created) {
    sleep(1);
    return;
  }

  let broadcastId;
  try {
    broadcastId = JSON.parse(createResponse.body).data.id;
  } catch {
    sleep(1);
    return;
  }

  const dispatchResponse = http.post(`${config.baseUrl}/broadcasts/${broadcastId}/dispatch`, null, {
    headers: jsonHeaders(data.token),
    tags: { name: "broadcast_dispatch" },
  });

  check(dispatchResponse, {
    "broadcast dispatched or already sent": (r) => [200, 201, 400].includes(r.status),
  });

  sleep(1);
}
