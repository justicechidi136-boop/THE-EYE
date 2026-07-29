import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { issueSmartwatchActivation } from "../../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { deviceId?: string; ttlMinutes?: number; connectivityMode?: string };
    const result = await issueSmartwatchActivation({
      deviceId: String(body.deviceId ?? ""),
      ttlMinutes: body.ttlMinutes,
      connectivityMode: body.connectivityMode,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error ? error.message : "Activation failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
