import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { fetchPoliceStation, updatePoliceStation } from "../../../../../lib/api/data";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? error.body as Record<string, unknown> : {};
    return NextResponse.json(
      {
        message: typeof body.message === "string" ? body.message : error.message,
        errorCode: body.errorCode,
        requestId: body.requestId,
        duplicates: body.duplicates,
      },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "Police station request failed";
  return NextResponse.json({ message }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const station = await fetchPoliceStation(id);
    if (!station) return NextResponse.json({ message: "Police station not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: station });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await updatePoliceStation(id, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
