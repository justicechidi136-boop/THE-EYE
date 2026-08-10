import { NextResponse } from "next/server";
import { ApiError } from "../../../../lib/api/client";
import {
  createAgency,
  listAgencies,
  type CreateAgencyInput,
} from "../../../../lib/api/agencies";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body ? (error.body as Record<string, unknown>) : {};
    return NextResponse.json(
      { message: typeof body.message === "string" ? body.message : error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const agencies = await listAgencies({
      countryCode: url.searchParams.get("countryCode") ?? undefined,
      stateCode: url.searchParams.get("stateCode") ?? undefined,
      lgaCode: url.searchParams.get("lgaCode") ?? undefined,
      agencyType: url.searchParams.get("agencyType") ?? undefined,
      capability: url.searchParams.get("capability") ?? undefined,
      isDispatchable: url.searchParams.get("isDispatchable") ?? undefined,
      isFieldOperationsEnabled: url.searchParams.get("isFieldOperationsEnabled") ?? undefined,
      isActive: url.searchParams.get("isActive") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });
    return NextResponse.json({ ok: true, data: agencies });
  } catch (error) {
    return errorResponse(error, "Failed to load agencies");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAgencyInput;
    if (!body.code?.trim() || !body.name?.trim() || !body.type || !body.jurisdictionLevel || !body.countryCode?.trim()) {
      return NextResponse.json(
        { message: "code, name, type, jurisdictionLevel, and countryCode are required" },
        { status: 400 },
      );
    }
    const agency = await createAgency(body);
    return NextResponse.json({ ok: true, data: agency }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create agency");
  }
}
