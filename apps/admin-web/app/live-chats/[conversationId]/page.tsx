import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { ConsolePageHeader } from "../../../components/console";
import { Panel, StatusBadge } from "../../../components/ui";
import { fetchSupportChat } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function LiveChatDetailPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const conversation = await fetchSupportChat(conversationId);
  if (!conversation) notFound();

  const messages = Array.isArray(conversation.messages)
    ? (conversation.messages as Array<Record<string, unknown>>)
    : [];
  const participants = Array.isArray(conversation.participants)
    ? (conversation.participants as Array<Record<string, unknown>>)
    : [];

  return (
    <AppShell>
      <ConsolePageHeader
        title={String(conversation.subject ?? "Conversation")}
        eyebrow={String(conversation.reference ?? "Live Chat")}
        breadcrumbs={["Chats", "Live Chat", String(conversation.reference ?? conversationId)]}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="info">{String(conversation.status)}</StatusBadge>
            <StatusBadge>{String(conversation.priority)}</StatusBadge>
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Panel title="Message timeline">
          <div className="grid gap-3">
            {messages.length ? (
              messages.map((message) => (
                <article
                  key={String(message.id)}
                  className={`rounded-lg border px-4 py-3 ${message.isInternal ? "border-warning/30 bg-warning/5" : "border-line bg-surfaceMuted"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{String(message.senderName ?? message.senderRole)}</p>
                    <time className="text-xs text-muted">{String(message.createdAt)}</time>
                  </div>
                  {message.isInternal ? <p className="mt-1 text-xs font-semibold uppercase text-warning">Internal note</p> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{String(message.body)}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted">No messages yet.</p>
            )}
          </div>
        </Panel>
        <div className="grid gap-5">
          <Panel title="Participants">
            <ul className="grid gap-2 text-sm">
              {participants.map((participant) => (
                <li key={String(participant.id)} className="rounded-md border border-line px-3 py-2">
                  <p className="font-semibold">{String(participant.displayName)}</p>
                  <p className="text-muted">{String(participant.role)}</p>
                </li>
              ))}
            </ul>
          </Panel>
          {conversation.incidentId ? (
            <Panel title="Linked incident">
              <Link href={`/incidents/${String(conversation.incidentId)}`} className="text-sm font-semibold text-eye hover:underline">
                Open incident centre record
              </Link>
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
