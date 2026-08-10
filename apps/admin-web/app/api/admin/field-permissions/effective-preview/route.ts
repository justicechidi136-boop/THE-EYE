import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { fetchFieldPermissionEffectivePreview } from "../../../../../lib/api/data";

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
    const preview = await fetchFieldPermissionEffectivePreview({
      profileId: url.searchParams.get("profileId") ?? undefined,
      overrides: url.searchParams.get("overrides") ?? undefined,
      denies: url.searchParams.get("denies") ?? undefined,
    });
    if (!preview) return NextResponse.json({ message: "Unable to compute preview" }, { status: 404 });
    return NextResponse.json({ ok: true, data: preview });
  } catch (error) {
    return errorResponse(error, "Failed to compute effective permission preview");
  }
}
