import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { fetchFieldDevicePolicy, patchFieldDevicePolicy } from "../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const policy = await fetchFieldDevicePolicy(id);
    if (!policy) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: policy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load policy";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const policy = await patchFieldDevicePolicy(id, body);
    return NextResponse.json({ ok: true, data: policy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update policy";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
