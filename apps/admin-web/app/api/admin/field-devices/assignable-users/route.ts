import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { listFieldAssignableUsers } from "../../../../../lib/api/data";

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json(
      { message: typeof body.message === "string" ? body.message : error.message },
      { status: error.status },
    );
  }
  return NextResponse.json({ message: "Unable to load assignable officers" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const agencyId = new URL(request.url).searchParams.get("agencyId")?.trim();
    if (!agencyId) return NextResponse.json({ message: "agencyId is required" }, { status: 400 });
    const users = await listFieldAssignableUsers(agencyId);
    return NextResponse.json({ ok: true, data: users });
  } catch (error) {
    return errorResponse(error);
  }
}
