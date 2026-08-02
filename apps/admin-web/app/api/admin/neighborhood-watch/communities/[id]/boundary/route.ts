import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id } = await context.params;
  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>(`/neighborhood-watch/communities/${id}/boundary`, {
      token,
    });
    return NextResponse.json({ ok: true, data: result.data ?? result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Boundary export failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
