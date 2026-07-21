import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { agencyId?: string; adminId?: string; reason?: string };

  try {
    const result = await apiRequest<Record<string, unknown>>(`/incidents/${id}/assign`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assignment failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
