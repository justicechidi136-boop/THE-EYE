import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { createDroneOperator } from "../../../../../lib/api/data";

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json(
      { message: typeof body.message === "string" ? body.message : error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "Drone operator creation failed";
  return NextResponse.json({ message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createDroneOperator(body as Record<string, unknown>);
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
