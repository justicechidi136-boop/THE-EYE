import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../../lib/session";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { id } = await params;
  try {
    const result = await apiRequest(`/smartwatch/sos/${encodeURIComponent(id)}/tracking`, { token });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = status === 403
      ? "This emergency location is outside your authorized scope."
      : "Live smartwatch location could not be refreshed.";
    return NextResponse.json({ message }, { status });
  }
}
