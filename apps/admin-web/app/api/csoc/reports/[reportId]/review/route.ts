import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { reportId } = await context.params;
  const body = (await request.json()) as { action?: "reviewed" | "dismissed"; note?: string };
  if (!body.action) return NextResponse.json({ message: "action is required" }, { status: 400 });

  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>(
      `/neighborhood-watch/reports/${reportId}/review`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ action: body.action, note: body.note }),
      },
    );
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report review failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
