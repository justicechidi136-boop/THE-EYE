import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../lib/session";

type RouteContext = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { membershipId } = await context.params;
  const body = (await request.json()) as { communityId?: string; roleName?: string };
  if (!body.communityId) return NextResponse.json({ message: "communityId is required" }, { status: 400 });
  if (!body.roleName) return NextResponse.json({ message: "roleName is required" }, { status: 400 });

  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>(
      `/neighborhood-watch/communities/${body.communityId}/memberships/${membershipId}/role`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ roleName: body.roleName }),
      },
    );
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Role assignment failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
