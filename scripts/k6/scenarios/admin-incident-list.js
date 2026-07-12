import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders } from "../lib/config.js";
import { loginAdmin } from "../lib/auth.js";

export const options = {
  scenarios: {
    admin_incident_list: {
      executor: "ramping-vus",
      startVUs: 2,
      stages: [
        { duration: "30s", target: 8 },
        { duration: "1m", target: 15 },
        { duration: "30s", target: 5 },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    "http_req_duration{name:incident_list}": ["p(95)<2000"],
    "http_req_duration{name:incident_detail}": ["p(95)<1500"],
  },
};

export function setup() {
  const token = loginAdmin();
  check({ token }, { "admin token acquired": (d) => Boolean(d.token) });
  return { token };
}

export default function adminIncidentList(data) {
  if (!data.token) return;

  const listResponse = http.get(`${config.baseUrl}/incidents?limit=50`, {
    headers: jsonHeaders(data.token),
    tags: { name: "incident_list" },
  });

  const listOk = check(listResponse, {
    "incident list ok": (r) => r.status === 200,
    "incident page metadata": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) && typeof body.hasMore === "boolean";
      } catch {
        return false;
      }
    },
  });

  if (!listOk) {
    sleep(0.5);
    return;
  }

  let incidentId = config.seedIncidentId;
  try {
    const rows = JSON.parse(listResponse.body).data;
    if (rows.length && rows[0].id) incidentId = rows[0].id;
  } catch {
    // keep seed id
  }

  const detailResponse = http.get(`${config.baseUrl}/incidents/${incidentId}`, {
    headers: jsonHeaders(data.token),
    tags: { name: "incident_detail" },
  });

  check(detailResponse, {
    "incident detail ok": (r) => r.status === 200,
  });

  sleep(0.3);
}
