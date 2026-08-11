import { NextResponse } from "next/server";
import { ApiError, apiRequest } from "../../../../../lib/api/client";

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; newPassword?: string };
  const token = body.token?.trim() ?? "";
  const newPassword = body.newPassword ?? "";

  if (!token || token.length < 10) {
    return NextResponse.json(
      { message: "This reset link is invalid or incomplete." },
      { status: 400 },
    );
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { message: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    await apiRequest("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      const message =
        error.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : error.status === 400 || error.status === 404
            ? "This reset link is invalid, expired, or already used."
            : "We couldn’t process your request right now.";
      return NextResponse.json({ message }, { status: error.status });
    }
    return NextResponse.json(
      { message: "We couldn’t process your request right now." },
      { status: 503 },
    );
  }
}
