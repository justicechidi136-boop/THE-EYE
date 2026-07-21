import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { decision?: string; note?: string; confidenceOverride?: number };
  if (!body.decision || !["confirm", "reject", "needs_more_evidence"].includes(body.decision)) {
    return NextResponse.json({ message: "decision must be confirm, reject, or needs_more_evidence" }, { status: 400 });
  }

  try {
    const result = await apiRequest<Record<string, unknown>>(`/verification/incidents/${id}/admin-review`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Incident review failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
