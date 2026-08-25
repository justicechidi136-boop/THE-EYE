import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../lib/api/client";
import { getAccessToken } from "../../../../lib/session";

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json(
      { message: typeof body.message === "string" ? body.message : error.message },
      { status: error.status },
    );
  }
  return NextResponse.json({ message: "Unable to manage operational accounts" }, { status: 500 });
}

export async function GET() {
  try {
    const token = await getAccessToken();
    const result = await apiRequest<unknown>("/users/admin-account-options", { token });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = await getAccessToken();
    const result = await apiRequest<unknown>("/users/admin-accounts", {
      method: "POST",
      token,
      body: JSON.stringify(await request.json()),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
