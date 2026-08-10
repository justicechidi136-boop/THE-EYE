import { NextResponse } from "next/server";
import { ApiError } from "../../../../lib/api/client";
import {
  createFieldPermissionProfile,
  fetchFieldPermissionProfiles,
  type CreateFieldPermissionProfileInput,
} from "../../../../lib/api/data";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json({ message: typeof body.message === "string" ? body.message : error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const profiles = await fetchFieldPermissionProfiles({
      isActive: url.searchParams.get("isActive") ?? undefined,
      operationalRole: url.searchParams.get("operationalRole") ?? undefined,
    });
    return NextResponse.json({ ok: true, data: profiles });
  } catch (error) {
    return errorResponse(error, "Failed to load permission profiles");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateFieldPermissionProfileInput;
    if (!body.code?.trim() || !body.name?.trim() || !Array.isArray(body.permissions) || !body.permissions.length) {
      return NextResponse.json({ message: "code, name, and at least one permission are required" }, { status: 400 });
    }
    const profile = await createFieldPermissionProfile(body);
    return NextResponse.json({ ok: true, data: profile }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create permission profile");
  }
}
