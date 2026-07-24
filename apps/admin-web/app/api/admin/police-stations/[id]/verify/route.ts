import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { verifyPoliceStation } from "../../../../../../lib/api/data";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await verifyPoliceStation(id, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Verification update failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
