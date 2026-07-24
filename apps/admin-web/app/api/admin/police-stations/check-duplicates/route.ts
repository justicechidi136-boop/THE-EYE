import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { checkPoliceStationDuplicates } from "../../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await checkPoliceStationDuplicates(body as Record<string, unknown>);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Duplicate check failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
