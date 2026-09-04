import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../lib/api/client";

export async function POST(request: Request) {
  try {
    const result = await apiRequest<unknown>("/auth/admin-invitations/accept", {
      method: "POST",
      body: JSON.stringify(await request.json()),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      const body = typeof error.body === "object" && error.body ? error.body as Record<string, unknown> : {};
      return NextResponse.json({ message: typeof body.message === "string" ? body.message : error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Unable to activate this account" }, { status: 500 });
  }
}
