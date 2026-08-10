import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import {
  fetchFieldDeviceProvisioning,
  updateFieldDeviceProvisioning,
  type UpdateFieldDeviceProvisioningInput,
} from "../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json({ message: typeof body.message === "string" ? body.message : error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const device = await fetchFieldDeviceProvisioning(id);
    if (!device) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: device });
  } catch (error) {
    return errorResponse(error, "Failed to load provisioning details");
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = (await request.json()) as UpdateFieldDeviceProvisioningInput;
    const device = await updateFieldDeviceProvisioning(id, body);
    return NextResponse.json({ ok: true, data: device });
  } catch (error) {
    return errorResponse(error, "Failed to update provisioning");
  }
}
