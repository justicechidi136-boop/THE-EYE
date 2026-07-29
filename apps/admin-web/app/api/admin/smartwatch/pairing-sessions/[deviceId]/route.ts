import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { revokeSmartwatchPairingSession } from "../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ deviceId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { deviceId } = await params;
  try {
    const result = await revokeSmartwatchPairingSession(deviceId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error ? error.message : "Revoke failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
