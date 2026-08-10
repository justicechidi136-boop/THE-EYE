import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { activateAgency } from "../../../../../../lib/api/agencies";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json(
      { message: typeof body.message === "string" ? body.message : error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const agency = await activateAgency(id);
    return NextResponse.json({ ok: true, data: agency });
  } catch (error) {
    return errorResponse(error, "Failed to activate agency");
  }
}
