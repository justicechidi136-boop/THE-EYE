import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../../lib/api/client";
import { getAccessToken } from "../../../../../../lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  const { id } = await context.params;
  try {
    const result = await apiRequest<Record<string, unknown>>(
      `/admin/agency-directory/recommendations/incidents/${encodeURIComponent(id)}`,
      { token },
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Agency recommendations are temporarily unavailable" },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  const { id } = await context.params;
  try {
    const result = await apiRequest<Record<string, unknown>>(
      `/admin/agency-directory/recommendations/incidents/${encodeURIComponent(id)}/reviews`,
      { token, method: "POST", body: JSON.stringify(await request.json()) },
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Recommendation review could not be saved" },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}
