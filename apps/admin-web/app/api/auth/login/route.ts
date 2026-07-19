import { NextResponse } from "next/server";
import { apiRequest } from "../../../../lib/api/client";
import { resolveServerApiDiagnostics } from "../../../../lib/public-env";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
  }

  try {
    const session = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: Record<string, unknown>;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: body.email, password: body.password, admin: true }),
    });

    const response = NextResponse.json({ ok: true, user: session.user });
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(ACCESS_TOKEN_COOKIE, session.accessToken, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: 60 * 60,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    const diagnostics = resolveServerApiDiagnostics();
    const unreachable =
      error instanceof TypeError ||
      (error instanceof Error &&
        /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Failed to fetch|network/i.test(error.message));
    if (unreachable) {
      console.error("[auth/login] API unreachable", {
        baseUrl: diagnostics.baseUrl,
        apiOriginConfigured: diagnostics.apiOriginConfigured,
        apiOriginHost: diagnostics.apiOriginHost,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const message = unreachable
      ? `Cannot reach the API at ${diagnostics.baseUrl}. Check that the API is running.`
      : error instanceof Error
        ? error.message
        : "Login failed";
    return NextResponse.json({ message }, { status: unreachable ? 503 : 401 });
  }
}

export async function GET() {
  return NextResponse.json(resolveServerApiDiagnostics());
}
