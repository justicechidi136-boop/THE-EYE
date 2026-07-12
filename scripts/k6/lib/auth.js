import http from "k6/http";
import { check } from "k6";
import { config, jsonHeaders } from "./config.js";

export function loginAdmin(email = config.adminEmail) {
  const response = http.post(
    `${config.baseUrl}/auth/login`,
    JSON.stringify({
      email,
      password: config.password,
      admin: true,
    }),
    { headers: jsonHeaders(), tags: { name: "auth_login_admin" } },
  );

  check(response, {
    "admin login status": (r) => r.status === 200 || r.status === 201,
    "admin login token": (r) => {
      try {
        return Boolean(JSON.parse(r.body).accessToken);
      } catch {
        return false;
      }
    },
  });

  if (response.status !== 200 && response.status !== 201) {
    return null;
  }

  return JSON.parse(response.body).accessToken;
}

export function loginSuperAdmin() {
  return loginAdmin(config.superAdminEmail);
}

export function loginCitizen() {
  const response = http.post(
    `${config.baseUrl}/auth/login`,
    JSON.stringify({
      email: config.citizenEmail,
      password: config.password,
      admin: false,
    }),
    { headers: jsonHeaders(), tags: { name: "auth_login_citizen" } },
  );

  check(response, {
    "citizen login status": (r) => r.status === 200 || r.status === 201,
    "citizen login token": (r) => {
      try {
        return Boolean(JSON.parse(r.body).accessToken);
      } catch {
        return false;
      }
    },
  });

  if (response.status !== 200 && response.status !== 201) {
    return null;
  }

  return JSON.parse(response.body).accessToken;
}
