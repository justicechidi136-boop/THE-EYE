import { NextRequest, NextResponse } from "next/server";
import { proxyAdminSupportChatMutation } from "../../../../../../lib/api/support-chat-admin";

type RouteContext = { params: Promise<{ conversationId: string; action: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { conversationId, action } = await context.params;
  const body = await request.json().catch(() => ({}));
  const path =
    action === "reply"
      ? `/support/admin/chats/${conversationId}/reply`
      : action === "internal-note"
        ? `/support/admin/chats/${conversationId}/internal-note`
        : action === "assign"
          ? `/support/admin/chats/${conversationId}/assign`
          : action === "escalate"
            ? `/support/admin/chats/${conversationId}/escalate`
            : action === "resolve"
              ? `/support/admin/chats/${conversationId}/resolve`
              : action === "close"
                ? `/support/admin/chats/${conversationId}/close`
                : action === "reopen"
                  ? `/support/admin/chats/${conversationId}/reopen`
                  : null;
  if (!path) return NextResponse.json({ message: "Unsupported action" }, { status: 404 });
  return proxyAdminSupportChatMutation(path, body);
}
