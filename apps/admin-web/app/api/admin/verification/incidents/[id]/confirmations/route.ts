import { NextResponse } from "next/server";
import { ApiError } from "../../../../../../../lib/api/client";
import { fetchWitnessConfirmations } from "../../../../../../../lib/api/data";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const confirmations = await fetchWitnessConfirmations(id);
    return NextResponse.json({ data: confirmations });
  } catch (error: unknown) {
    const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unable to load witness confirmations";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message }, { status });
  }
}
