/**
 * Shared k6 configuration for THE EYE load tests.
 * Override via environment variables (see env.example).
 */

export const config = {
  baseUrl: __ENV.BASE_URL || "http://localhost:4000/v1",
  adminEmail: __ENV.DEV_DISPATCHER_EMAIL || "dispatcher.ikeja@theeye.local",
  superAdminEmail: __ENV.ADMIN_EMAIL || "dev-admin@theeye.local",
  citizenEmail: __ENV.CITIZEN_EMAIL || "citizen@theeye.local",
  citizenPhone: __ENV.CITIZEN_PHONE || "+2348000002001",
  password: __ENV.ADMIN_PASSWORD || "change_me_dev_admin_password",
  seedIncidentId: __ENV.SEED_INCIDENT_ID || "66666666-6666-6666-6666-666666666666",
  seedJurisdictionId: __ENV.SEED_JURISDICTION_ID || "11111111-1111-1111-1111-111111111111",
  seedCitizenId: __ENV.SEED_CITIZEN_ID || "55555555-5555-5555-5555-555555555555",
  watchDeviceId: __ENV.WATCH_DEVICE_ID || "watch-seed-001",
  latitude: Number(__ENV.TEST_LAT || "6.6012"),
  longitude: Number(__ENV.TEST_LNG || "3.3514"),
};

export const defaultThresholds = {
  http_req_failed: ["rate<0.05"],
  http_req_duration: ["p(95)<2000"],
};

export function jsonHeaders(token) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function checkResponse(response, name, expectedStatuses = [200, 201]) {
  const ok = expectedStatuses.includes(response.status);
  return {
    [`${name} status`]: (r) => expectedStatuses.includes(r.status),
    [`${name} body`]: (r) => {
      if (!ok) return true;
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function randomCoord(base, spread = 0.002) {
  return base + (Math.random() - 0.5) * spread;
}

export function uniqueSuffix() {
  return `${__VU}-${__ITER}-${Date.now()}`;
}
