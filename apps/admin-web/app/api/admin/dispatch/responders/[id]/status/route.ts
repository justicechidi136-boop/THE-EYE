import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import { updateResponderAvailability } from "../../../../../../../lib/api/dispatch";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  try {
    const result = await updateResponderAvailability(id, body);
    return NextResponse.json({ ok: true, data: result });
  } catch (error: unknown) {
    const message =
      error instanceof ApiError
        ? typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message
        : error instanceof Error
          ? error.message
          : "Responder update failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
