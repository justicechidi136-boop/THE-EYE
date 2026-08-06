import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { fieldDeviceAction, type FieldDeviceAdminAction } from "../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ id: string; action: string }> };

const ALLOWED: FieldDeviceAdminAction[] = [
  "approve",
  "reject",
  "suspend",
  "restore",
  "mark-lost",
  "revoke",
  "require-re-pair",
  "force-sign-out",
];

export async function POST(request: Request, { params }: RouteParams) {
  const { id, action } = await params;
  if (!ALLOWED.includes(action as FieldDeviceAdminAction)) {
    return NextResponse.json({ message: `Unsupported action: ${action}` }, { status: 400 });
  }
  try {
    const body = (await request.json()) as {
      reason?: string;
      note?: string;
      assignedUserId?: string;
      assignedUnitId?: string;
    };
    const result = await fieldDeviceAction(id, action as FieldDeviceAdminAction, body);
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message
        : error instanceof Error
          ? error.message
          : "Field device action failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
