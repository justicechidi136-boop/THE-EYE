import { NextRequest, NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ incidentId: string; action?: string[] }> };

async function proxy(
  incidentId: string,
  suffix: string,
  init?: RequestInit,
) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const data = await apiRequest<unknown>(`/incidents/${incidentId}${suffix}`, {
    ...init,
    token,
  });
  return NextResponse.json(data);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { incidentId } = await context.params;
  const pathname = request.nextUrl.pathname;
  if (pathname.endsWith("/messages")) {
    return proxy(incidentId, "/messages");
  }
  return proxy(incidentId, "/conversation");
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { incidentId } = await context.params;
  const pathname = request.nextUrl.pathname;
  const body = await request.text();
  if (pathname.endsWith("/information-requests")) {
    return proxy(incidentId, "/information-requests", { method: "POST", body });
  }
  if (pathname.endsWith("/conversation/restrict")) {
    return proxy(incidentId, "/conversation/restrict", { method: "POST", body });
  }
  if (pathname.endsWith("/conversation/close")) {
    return proxy(incidentId, "/conversation/close", { method: "POST", body });
  }
  const reportMatch = pathname.match(/\/messages\/([^/]+)\/report$/);
  if (reportMatch) {
    return proxy(incidentId, `/messages/${reportMatch[1]}/report`, { method: "POST", body });
  }
  return proxy(incidentId, "/messages", { method: "POST", body });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { incidentId } = await context.params;
  const pathname = request.nextUrl.pathname;
  const body = await request.text();
  const readMatch = pathname.match(/\/messages\/([^/]+)\/read$/);
  if (readMatch) {
    return proxy(incidentId, `/messages/${readMatch[1]}/read`, { method: "PATCH", body });
  }
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
