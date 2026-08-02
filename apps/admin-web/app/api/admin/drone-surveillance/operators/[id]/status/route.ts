import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import { updateDroneOperatorStatus } from "../../../../../../../lib/api/data";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json(
      { message: typeof body.message === "string" ? body.message : error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "Drone operator status update failed";
  return NextResponse.json({ message }, { status: 500 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { accountStatus?: string; availabilityStatus?: string; isActive?: boolean };
    const result = await updateDroneOperatorStatus(id, body);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
