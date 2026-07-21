import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string; mediaId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id, mediaId } = await context.params;
  try {
    const result = await apiRequest<Record<string, unknown>>(`/incidents/${id}/media/${mediaId}/view`, {
      token,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence view failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
