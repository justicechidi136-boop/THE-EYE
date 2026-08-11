import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../lib/api/client";

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string };
  const token = body.token?.trim() ?? "";

  if (!token || token.length < 10) {
    return NextResponse.json(
      { message: "This recovery link is invalid or incomplete." },
      { status: 400 },
    );
  }

  try {
    const result = await apiRequest<Record<string, unknown>>("/auth/account-recovery/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ApiError) {
      const message =
        error.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : error.status === 400 || error.status === 404
            ? "This recovery link is invalid, expired, or already used."
            : "We couldn’t process your request right now.";
      return NextResponse.json({ message }, { status: error.status });
    }
    return NextResponse.json(
      { message: "We couldn’t process your request right now." },
      { status: 503 },
    );
  }
}
