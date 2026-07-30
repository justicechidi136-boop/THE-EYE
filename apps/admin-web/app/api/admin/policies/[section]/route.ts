import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../lib/api/client";
import { getAccessToken } from "../../../../../lib/session";

type RouteContext = { params: Promise<{ section: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { section } = await context.params;
  const body = (await request.json()) as {
    scope?: "platform" | "jurisdiction" | "community";
    communityId?: string;
    config?: Record<string, unknown>;
    changeReason?: string;
  };

  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>(`/admin/policies/${section}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Policy update failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
