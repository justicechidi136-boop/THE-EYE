import { NextResponse } from "next/server";
import { apiRequest } from "../../../../lib/api/client";
import { getAccessToken } from "../../../../lib/session";

export async function POST(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const body = await request.json();
  try {
    const result = await apiRequest<{ data: Record<string, unknown> }>("/admin/stolen-vehicles", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: true, data: result.data ?? result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stolen vehicle case creation failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
