import http from "k6/http";
import { check } from "k6";
import { config, jsonHeaders, randomCoord } from "./lib/config.js";
import { loginAdmin, loginCitizen, loginSuperAdmin } from "./lib/auth.js";

/**
 * Quick validation that seeded credentials and core endpoints respond.
 * Run before heavier scenarios: k6 run scripts/k6/smoke.js
 */
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate>0.90"],
  },
};

export default function () {
  const health = http.get(`${config.baseUrl}/health`);
  check(health, { "health live": (r) => r.status === 200 });

  const ready = http.get(`${config.baseUrl}/health/ready`);
  check(ready, { "health ready": (r) => r.status === 200 });

  const adminToken = loginAdmin();
  const citizenToken = loginCitizen();
  const superAdminToken = loginSuperAdmin();

  check({ adminToken, citizenToken, superAdminToken }, {
    "tokens issued": (d) => Boolean(d.adminToken && d.citizenToken && d.superAdminToken),
  });

  if (adminToken) {
    const incidents = http.get(`${config.baseUrl}/incidents?limit=5`, {
      headers: jsonHeaders(adminToken),
      tags: { name: "smoke_incident_list" },
    });
    check(incidents, { "admin incident list": (r) => r.status === 200 });
  }

  const report = http.post(
    `${config.baseUrl}/incidents/report`,
    JSON.stringify({
      type: "CommunitySafety",
      description: "k6 smoke incident",
      latitude: config.latitude,
      longitude: config.longitude,
      anonymous: true,
    }),
    { headers: jsonHeaders(), tags: { name: "smoke_incident_report" } },
  );
  check(report, { "incident report": (r) => [200, 201, 429].includes(r.status) });

  if (citizenToken) {
    const sos = http.post(
      `${config.baseUrl}/smartwatch/sos`,
      JSON.stringify({
        deviceId: config.watchDeviceId,
        latitude: config.latitude,
        longitude: config.longitude,
        longPressDurationMs: 3000,
        emergencyMode: "NormalSOS",
      }),
      { headers: jsonHeaders(citizenToken), tags: { name: "smoke_sos" } },
    );
    check(sos, { "sos submit": (r) => [200, 201, 429].includes(r.status) });

    const gps = http.post(
      `${config.baseUrl}/smartwatch/devices/${config.watchDeviceId}/gps`,
      JSON.stringify({
        latitude: randomCoord(config.latitude, 0.0005),
        longitude: randomCoord(config.longitude, 0.0005),
        capturedAt: new Date().toISOString(),
      }),
      { headers: jsonHeaders(citizenToken), tags: { name: "smoke_gps" } },
    );
    check(gps, { "smartwatch gps": (r) => r.status === 200 || r.status === 201 });

    const notifications = http.get(`${config.baseUrl}/notifications?limit=10`, {
      headers: jsonHeaders(citizenToken),
      tags: { name: "smoke_notification_list" },
    });
    check(notifications, { "notification list": (r) => r.status === 200 });
  }

  if (adminToken) {
    const broadcast = http.post(
      `${config.baseUrl}/broadcasts`,
      JSON.stringify({
        type: "CommunityWarning",
        title: "k6 smoke broadcast",
        body: "Synthetic broadcast for smoke testing.",
        priority: "P4GeneralSafety",
        jurisdictionId: config.seedJurisdictionId,
        latitude: config.latitude,
        longitude: config.longitude,
        radiusMeters: 2000,
        requiresApproval: false,
      }),
      { headers: jsonHeaders(adminToken), tags: { name: "smoke_broadcast_create" } },
    );
    check(broadcast, { "broadcast create": (r) => r.status === 200 || r.status === 201 });
  }

  if (superAdminToken) {
    const notify = http.post(
      `${config.baseUrl}/notifications/send`,
      JSON.stringify({
        userId: config.seedCitizenId,
        type: "EmergencyAlert",
        title: "k6 smoke notification",
        body: "Queue smoke test",
        channels: ["in_app"],
        incidentId: config.seedIncidentId,
      }),
      { headers: jsonHeaders(superAdminToken), tags: { name: "smoke_notification_send" } },
    );
    check(notify, { "notification send": (r) => r.status === 200 || r.status === 201 });
  }
}
