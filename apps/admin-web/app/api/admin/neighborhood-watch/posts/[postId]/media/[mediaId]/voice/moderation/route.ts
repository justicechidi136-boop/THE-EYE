import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../../../../lib/session";

type RouteContext = { params: Promise<{ postId: string; mediaId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { postId, mediaId } = await context.params;
  const body = await request.json();

  try {
    const result = await apiRequest<Record<string, unknown>>(
      `/neighborhood-watch/posts/${postId}/media/${mediaId}/voice/moderation`,
      {
        method: "PUT",
        token,
        body,
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice moderation update failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
