import { NextResponse } from "next/server";
import { clearAuthCookies } from "./auth-cookies";

export function createLogoutResponse() {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login" },
  });
  clearAuthCookies(response);
  return response;
}
