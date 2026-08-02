import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../lib/api/client";
import { launchDroneMissionFromIncident } from "../../../../../../lib/api/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      incidentId?: string;
      droneId?: string;
      title?: string;
      description?: string;
      priority?: string;
    };
    const result = await launchDroneMissionFromIncident({
      incidentId: String(body.incidentId ?? ""),
      droneId: body.droneId,
      title: body.title,
      description: body.description,
      priority: body.priority,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      const message =
        typeof error.body === "object" && error.body && "message" in error.body
          ? String((error.body as { message?: string }).message)
          : error.message;
      return NextResponse.json({ message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Drone mission launch failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
