import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { sendNotification } from "../../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      type?: string;
      priority?: string;
      channels?: string[];
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      userId?: string;
      adminUserId?: string;
    };

    if (!body.title || !body.body || !body.type) {
      return NextResponse.json({ message: "title, body, and type are required" }, { status: 400 });
    }

    const result = await sendNotification({
      title: body.title,
      body: body.body,
      type: body.type,
      priority: body.priority,
      channels: body.channels,
      latitude: body.latitude,
      longitude: body.longitude,
      radiusMeters: body.radiusMeters,
      userId: body.userId,
      adminUserId: body.adminUserId,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Notification dispatch failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
