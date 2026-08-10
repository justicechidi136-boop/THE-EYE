import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import {
  fetchFieldPermissionProfile,
  updateFieldPermissionProfile,
  type UpdateFieldPermissionProfileInput,
} from "../../../../../lib/api/data";

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
    const profile = await fetchFieldPermissionProfile(id);
    if (!profile) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: profile });
  } catch (error) {
    return errorResponse(error, "Failed to load permission profile");
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = (await request.json()) as UpdateFieldPermissionProfileInput;
    const profile = await updateFieldPermissionProfile(id, body);
    return NextResponse.json({ ok: true, data: profile });
  } catch (error) {
    return errorResponse(error, "Failed to update permission profile");
  }
}
