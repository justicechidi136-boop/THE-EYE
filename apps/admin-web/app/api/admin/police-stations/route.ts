import { NextResponse } from "next/server";
import { ApiError } from "../../../../lib/api/client";
import { createPoliceStation } from "../../../../lib/api/data";

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
  const message = error instanceof Error ? error.message : "Police station creation failed";
  return NextResponse.json({ message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createPoliceStation(body as Record<string, unknown>);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
