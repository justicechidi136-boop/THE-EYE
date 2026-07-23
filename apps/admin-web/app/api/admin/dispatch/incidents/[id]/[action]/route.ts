import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import {
  assignDispatchIncident,
  escalateDispatchIncident,
  fetchDispatchAssignment,
  reassignDispatchIncident,
  requestDispatchInfo,
  updateDispatchTriage,
} from "../../../../../../../lib/api/dispatch";

type RouteParams = { params: Promise<{ id: string; action: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id, action } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  try {
    if (action === "assign" || action === "reassign") {
      const result =
        action === "reassign"
          ? await reassignDispatchIncident(id, body)
          : await assignDispatchIncident(id, body);
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "escalate") {
      const result = await escalateDispatchIncident(id, {
        reason: String(body.reason ?? "Escalated from command center"),
        destinationAgencyId: typeof body.destinationAgencyId === "string" ? body.destinationAgencyId : undefined,
        requestBackup: body.requestBackup === true,
      });
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "request-info") {
      const result = await requestDispatchInfo(id, String(body.reason ?? "More information requested"));
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "triage") {
      const overrideReason = String(body.overrideReason ?? body.reason ?? "").trim();
      const result = await updateDispatchTriage(id, {
        priority: String(body.priority ?? "P1LifeThreatening"),
        overrideReason: overrideReason || "Priority updated from command center",
      });
      return NextResponse.json({ ok: true, data: result });
    }
    if (action === "assignment") {
      const assignmentId = String(body.assignmentId ?? "");
      if (!assignmentId) {
        return NextResponse.json({ message: "assignmentId is required" }, { status: 400 });
      }
      const result = await fetchDispatchAssignment(assignmentId);
      return NextResponse.json({ ok: true, data: result });
    }
    return NextResponse.json({ message: `Unsupported dispatch action: ${action}` }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message
        : error instanceof Error
          ? error.message
          : "Dispatch action failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
