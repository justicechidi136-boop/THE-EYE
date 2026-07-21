import { NextResponse } from "next/server";
import { apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

type RouteContext = { params: Promise<{ kycId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { kycId } = await context.params;
  const body = (await request.json()) as { decision?: string; reason?: string };
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ message: "decision must be approve or reject" }, { status: 400 });
  }

  try {
    const result = await apiRequest<Record<string, unknown>>(`/users/kyc/${kycId}/review`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        decision: body.decision,
        reason: body.reason,
      }),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "KYC review failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
