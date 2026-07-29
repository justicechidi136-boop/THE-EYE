import { NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/api/client";
import { publishSmartwatchFirmware } from "../../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await publishSmartwatchFirmware({
      version: String(body.version ?? ""),
      title: String(body.title ?? ""),
      releaseNotes: typeof body.releaseNotes === "string" ? body.releaseNotes : undefined,
      downloadUrl: String(body.downloadUrl ?? ""),
      fileHash: String(body.fileHash ?? ""),
      signature: String(body.signature ?? ""),
      status: typeof body.status === "string" ? body.status : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error ? error.message : "Firmware publish failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
