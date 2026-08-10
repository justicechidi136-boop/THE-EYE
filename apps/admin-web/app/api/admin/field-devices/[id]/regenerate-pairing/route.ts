import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { regenerateFieldDevicePairingCode } from "../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json({ message: typeof body.message === "string" ? body.message : error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = (await request.json().catch(() => ({}))) as { ttlMinutes?: number };
    const pairing = await regenerateFieldDevicePairingCode(id, body);
    return NextResponse.json({ ok: true, data: pairing });
  } catch (error) {
    return errorResponse(error, "Failed to regenerate pairing code");
  }
}
