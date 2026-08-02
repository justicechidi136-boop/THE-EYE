import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../lib/api/client";
import { getAccessToken } from "../../../../../lib/session";

export async function POST(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const body = (await request.json()) as { communityId?: string; title?: string; startsAt?: string; endsAt?: string; volunteerUserIds?: string[] };
  if (!body.communityId) return NextResponse.json({ message: "communityId is required" }, { status: 400 });

  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>(
      `/neighborhood-watch/communities/${body.communityId}/patrols`,
      {
        method: "POST",
        token,
        body: JSON.stringify({
          title: body.title,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          volunteerUserIds: body.volunteerUserIds,
        }),
      },
    );
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Patrol creation failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
