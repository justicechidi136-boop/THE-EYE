import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import { fetchLiveVideoLatestLocation } from "../../../../../../../lib/api/data";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const result = await fetchLiveVideoLatestLocation(sessionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Unable to load live location";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
