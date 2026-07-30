import { NextResponse } from "next/server";
import { ApiError } from "../../../../lib/api/client";
import { sendStagingWatchTestAlert } from "../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      deviceId?: string;
      alertCode?: string;
      languageHint?: string;
      priority?: "CRITICAL" | "HIGH" | "MEDIUM";
    };

    if (!body.userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    const result = await sendStagingWatchTestAlert({
      userId: body.userId,
      deviceId: body.deviceId,
      alertCode: body.alertCode,
      languageHint: body.languageHint,
      priority: body.priority,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof ApiError
        ? typeof error.body === "object" &&
          error.body &&
          "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message
        : error instanceof Error
          ? error.message
          : "Staging test alert failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
