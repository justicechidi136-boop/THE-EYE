import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../lib/session";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  const { sessionId } = await context.params;
  try {
    return NextResponse.json(await apiRequest<Record<string, unknown>>(`/live-video/sessions/${encodeURIComponent(sessionId)}/location/history`, { token }));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Movement trail unavailable" }, { status: error instanceof ApiError ? error.status : 500 });
  }
}
