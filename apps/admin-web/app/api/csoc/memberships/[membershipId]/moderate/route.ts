import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { membershipId } = await context.params;
  const body = (await request.json()) as {
    communityId?: string;
    action?: "suspend" | "restore" | "ban" | "unban";
    note?: string;
  };
  if (!body.communityId) return NextResponse.json({ message: "communityId is required" }, { status: 400 });
  if (!body.action) return NextResponse.json({ message: "action is required" }, { status: 400 });

  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>(
      `/neighborhood-watch/communities/${body.communityId}/memberships/${membershipId}/moderate`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ action: body.action, note: body.note ?? undefined }),
      },
    );
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Moderation failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
