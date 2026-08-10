import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { fetchAgency, updateAgency, type UpdateAgencyInput } from "../../../../../lib/api/agencies";

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const agency = await fetchAgency(id);
    if (!agency) return NextResponse.json({ message: "Agency not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: agency });
  } catch (error) {
    return errorResponse(error, "Failed to load agency");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateAgencyInput;
    const agency = await updateAgency(id, body);
    return NextResponse.json({ ok: true, data: agency });
  } catch (error) {
    return errorResponse(error, "Failed to update agency");
  }
}
