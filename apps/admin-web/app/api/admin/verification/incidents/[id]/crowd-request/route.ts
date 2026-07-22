import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import { requestCrowdConfirmation } from "../../../../../../../lib/api/data";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { limit?: number; radiusMeters?: number };
    const result = await requestCrowdConfirmation(id, body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unable to request crowd confirmation";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
