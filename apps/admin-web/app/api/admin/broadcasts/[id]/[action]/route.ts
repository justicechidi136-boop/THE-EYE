import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import {
  approveBroadcast,
  cancelBroadcast,
  dispatchBroadcast,
  estimateBroadcastRecipients,
  fetchBroadcastProgress,
  previewBroadcast,
  rejectBroadcast,
  retryBroadcast,
  scheduleBroadcast,
  suspendBroadcast,
  restoreBroadcast,
  verifyBroadcast,
  resolveBroadcast,
  deleteBroadcast,
  addOfficialBroadcastComment,
} from "../../../../../../lib/api/data";

type RouteParams = { params: Promise<{ id: string; action: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, action } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  try {
    if (action === "approve") {
      const result = await approveBroadcast(id, typeof body.note === "string" ? body.note : undefined);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "reject") {
      const result = await rejectBroadcast(id, String(body.reason ?? "Rejected"));
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "schedule") {
      const result = await scheduleBroadcast(id, String(body.scheduledAt ?? ""));
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "cancel") {
      const result = await cancelBroadcast(id, typeof body.reason === "string" ? body.reason : undefined);
      return NextResponse.json({ ok: true, data: result });
    }
    return NextResponse.json({ message: `Unsupported broadcast action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Broadcast action failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id, action } = await params;

  try {
    if (action === "dispatch") {
      const result = await dispatchBroadcast(id);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "retry") {
      const result = await retryBroadcast(id);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "preview") {
      const result = await previewBroadcast(id);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "estimate") {
      const result = await estimateBroadcastRecipients(id);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "progress") {
      const result = await fetchBroadcastProgress(id);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "suspend") {
      const body = (await _request.json()) as Record<string, unknown>;
      const result = await suspendBroadcast(id, typeof body.reason === "string" ? body.reason : undefined);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "restore") {
      const result = await restoreBroadcast(id);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "verify") {
      const body = (await _request.json()) as Record<string, unknown>;
      const result = await verifyBroadcast(id, typeof body.note === "string" ? body.note : undefined);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "resolve") {
      const body = (await _request.json()) as Record<string, unknown>;
      const result = await resolveBroadcast(id, typeof body.note === "string" ? body.note : undefined);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "comment") {
      const body = (await _request.json()) as Record<string, unknown>;
      const result = await addOfficialBroadcastComment(
        id,
        String(body.body ?? ""),
        body.pin === true,
      );
      return NextResponse.json({ ok: true, data: result });
    }
    return NextResponse.json({ message: `Unsupported broadcast action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Broadcast action failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id, action } = await params;
  if (action !== "delete") {
    return NextResponse.json({ message: `Unsupported broadcast action: ${action}` }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await deleteBroadcast(id, typeof body.reason === "string" ? body.reason : undefined);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof ApiError
      ? (typeof error.body === "object" && error.body && "message" in error.body ? String((error.body as { message?: string }).message) : error.message)
      : error instanceof Error
        ? error.message
        : "Broadcast action failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
