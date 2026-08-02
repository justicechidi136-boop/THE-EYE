import { NextResponse } from "next/server";
import { getAccessToken } from "../../session";
import { resolveServerApiBaseUrl } from "../public-env";

export async function proxyAdminSupportChatMutation(path: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const response = await fetch(`${resolveServerApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
