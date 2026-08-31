import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { updateDirectoryAccountStatus } from "../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const kind = body.kind === "admin" ? "admin" : "citizen";
  const status = String(body.status ?? "") as "Active" | "Suspended" | "Deactivated";
  const reason = String(body.reason ?? "");

  try {
    const result = await updateDirectoryAccountStatus(id, kind, status, reason);
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body
        ? String((error.body as { message?: string }).message)
        : error.message)
      : error instanceof Error
        ? error.message
        : "Account action failed";
    return NextResponse.json({ message }, { status: error instanceof ApiError ? error.status : 500 });
  }
}
