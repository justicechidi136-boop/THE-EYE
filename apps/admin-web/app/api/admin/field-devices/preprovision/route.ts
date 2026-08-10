import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { preprovisionFieldDevice, type PreProvisionFieldDeviceInput } from "../../../../../lib/api/data";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json({ message: typeof body.message === "string" ? body.message : error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreProvisionFieldDeviceInput;
    if (!body.deviceName || !body.deviceName.trim()) {
      return NextResponse.json({ message: "Device name is required" }, { status: 400 });
    }
    const device = await preprovisionFieldDevice(body);
    return NextResponse.json({ ok: true, data: device }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to pre-provision field device");
  }
}
