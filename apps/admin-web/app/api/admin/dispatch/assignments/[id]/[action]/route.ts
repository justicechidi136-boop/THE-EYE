import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import {
  addAssignmentNote,
  requestAssignmentBackup,
  updateDispatchAssignment,
} from "../../../../../../../lib/api/dispatch";

type RouteParams = { params: Promise<{ id: string; action: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id, action } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  try {
    if (action === "request-backup") {
      const result = await requestAssignmentBackup(id, String(body.reason ?? "Backup requested"));
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "note") {
      const result = await addAssignmentNote(
        id,
        String(body.note ?? ""),
        typeof body.clientActionId === "string" ? body.clientActionId : undefined,
      );
      return NextResponse.json({ ok: true, data: result });
    }
    return NextResponse.json({ message: `Unsupported assignment action: ${action}` }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message
        : error instanceof Error
          ? error.message
          : "Assignment action failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, action } = await params;
  if (action !== "cancel") {
    return NextResponse.json({ message: `Unsupported assignment action: ${action}` }, { status: 400 });
  }
  const body = (await request.json()) as Record<string, unknown>;

  try {
    const result = await updateDispatchAssignment(id, body);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message
        : error instanceof Error
          ? error.message
          : "Assignment update failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
