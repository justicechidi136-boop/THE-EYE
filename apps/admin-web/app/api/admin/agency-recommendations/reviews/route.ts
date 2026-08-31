import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../lib/api/client";
import { getAccessToken } from "../../../../../lib/session";

export async function GET(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  const source = new URL(request.url);
  try {
    const result = await apiRequest<Record<string, unknown>>(
      "/admin/agency-directory/recommendations/reviews/quality",
      { token, query: Object.fromEntries(source.searchParams.entries()) },
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Recommendation quality report is temporarily unavailable" },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}
