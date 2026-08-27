import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string; mediaId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  const { id, mediaId } = await context.params;
  try {
    const result = await apiRequest<Record<string, unknown>>(
      `/admin/broadcasts/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}/view`,
      { token },
    );
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Broadcast evidence view failed";
    return NextResponse.json({ message }, { status });
  }
}
