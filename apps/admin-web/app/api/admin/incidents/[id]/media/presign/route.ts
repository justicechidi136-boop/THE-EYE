import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  try {
    const result = await apiRequest<Record<string, unknown>>(`/incidents/${id}/media/presign`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence upload preparation failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
