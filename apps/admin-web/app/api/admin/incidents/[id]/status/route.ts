import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { status?: string; note?: string };
  if (!body.status) {
    return NextResponse.json({ message: "status is required" }, { status: 400 });
  }

  try {
    const result = await apiRequest<Record<string, unknown>>(`/incidents/${id}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status update failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
