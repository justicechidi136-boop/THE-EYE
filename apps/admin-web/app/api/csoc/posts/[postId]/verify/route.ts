import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ postId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { postId } = await context.params;
  const body = (await request.json()) as { status?: string; moderatorConfirmed?: boolean; note?: string };
  if (!body.status) return NextResponse.json({ message: "status is required" }, { status: 400 });

  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>(
      `/neighborhood-watch/posts/${postId}/verify`,
      { method: "PATCH", token, body: JSON.stringify(body) },
    );
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
