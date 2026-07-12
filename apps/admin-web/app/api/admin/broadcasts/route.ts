import { NextResponse } from "next/server";
import { ApiError } from "../../../../lib/api/client";
import { createBroadcast } from "../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: string;
      title?: string;
      body?: string;
      priority?: string;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      targetAreaWkt?: string;
    };

    if (!body.type || !body.title || !body.body || !body.priority) {
      return NextResponse.json({ message: "type, title, body, and priority are required" }, { status: 400 });
    }

    const result = await createBroadcast({
      type: body.type,
      title: body.title,
      body: body.body,
      priority: body.priority,
      latitude: body.latitude,
      longitude: body.longitude,
      radiusMeters: body.radiusMeters,
      targetAreaWkt: body.targetAreaWkt,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Broadcast creation failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
