import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string; action: string }> };

export async function POST(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id, action } = await context.params;
  const body = (await request.json()) as { reason?: string; note?: string };

  try {
    const result = await apiRequest<Record<string, unknown>>(
      `/smartwatch/admin/devices/${id}/actions/${action}`,
      {
        method: "POST",
        token,
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Smartwatch action failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
