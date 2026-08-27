import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  const { id } = await context.params;
  try {
    return NextResponse.json(await apiRequest<Record<string, unknown>>(`/incidents/${encodeURIComponent(id)}/location-history?limit=100`, { token }));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Location history unavailable" }, { status: error instanceof ApiError ? error.status : 500 });
  }
}
