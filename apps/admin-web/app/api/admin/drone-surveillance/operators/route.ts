import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { createDroneOperator } from "../../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      callsign?: string;
      operatorRole?: string;
      certificationLevel?: string;
    };
    const result = await createDroneOperator({
      name: String(body.name ?? ""),
      email: body.email,
      callsign: body.callsign,
      operatorRole: body.operatorRole,
      certificationLevel: body.certificationLevel,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      const message =
        typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message;
      return NextResponse.json({ message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create operator";
    return NextResponse.json({ message }, { status: 500 });
  }
}
