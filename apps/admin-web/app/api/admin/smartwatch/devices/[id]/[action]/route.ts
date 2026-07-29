import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import { smartwatchDeviceAction } from "../../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ id: string; action: string }> };

export async function PATCH(_request: Request, { params }: RouteParams) {
  const { id, action } = await params;
  if (action !== "activate" && action !== "deactivate" && action !== "remote-wipe") {
    return NextResponse.json({ message: `Unsupported action: ${action}` }, { status: 400 });
  }
  try {
    const result = await smartwatchDeviceAction(id, action);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message
        : error instanceof Error
          ? error.message
          : "Device action failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
