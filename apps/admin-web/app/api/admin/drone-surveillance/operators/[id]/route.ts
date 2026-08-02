import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { updateDroneOperator } from "../../../../../../lib/api/data";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json(
      { message: typeof body.message === "string" ? body.message : error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "Drone operator update failed";
  return NextResponse.json({ message }, { status: 500 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await updateDroneOperator(id, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
