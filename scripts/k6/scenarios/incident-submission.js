import http from "k6/http";
import { check, sleep } from "k6";
import { config, jsonHeaders, randomCoord, uniqueSuffix } from "../lib/config.js";

export const options = {
  scenarios: {
    incident_submission: {
      executor: "constant-arrival-rate",
      rate: 3,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 10,
      maxVUs: 25,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.15"],
    "http_req_duration{name:incident_report}": ["p(95)<3000"],
    "http_req_duration{name:incident_emergency}": ["p(95)<3000"],
  },
};

export function setup() {
  const health = http.get(`${config.baseUrl}/health`);
  check(health, { "api reachable": (r) => r.status === 200 });
  return {};
}

export default function incidentSubmission() {
  const emergency = __ITER % 5 === 0;
  const path = emergency ? "/incidents/emergency" : "/incidents/report";
  const payload = {
    type: emergency ? "Emergency" : "Crime",
    description: `k6 load test incident ${uniqueSuffix()}`,
    latitude: randomCoord(config.latitude),
    longitude: randomCoord(config.longitude),
    anonymous: true,
  };

  const response = http.post(`${config.baseUrl}${path}`, JSON.stringify(payload), {
    headers: jsonHeaders(),
    tags: { name: emergency ? "incident_emergency" : "incident_report" },
  });

  check(response, {
    "incident submitted or limited": (r) => [201, 200, 400, 429].includes(r.status),
    "incident id when created": (r) => {
      if (r.status !== 200 && r.status !== 201) return true;
      try {
        return Boolean(JSON.parse(r.body).id);
      } catch {
        return false;
      }
    },
  });

  sleep(0.5);
}
