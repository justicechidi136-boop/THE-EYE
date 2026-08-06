"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "../ui";

type IncidentMessage = {
  id: string;
  messageType: string;
  body: string;
  senderRole: string;
  senderLabel: string;
  createdAt: string;
  deliveryState?: string;
};

type ConversationResponse = {
  data?: {
    status?: string;
    unreadMessageCount?: number;
    lastMessagePreview?: string | null;
  };
};

type MessagesResponse = {
  data?: IncidentMessage[];
  readOnly?: boolean;
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/incident-communications${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function IncidentCommunicationPanel({ incidentId }: { incidentId: string }) {
  const [messages, setMessages] = useState<IncidentMessage[]>([]);
  const [status, setStatus] = useState("Active");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [conversation, thread] = await Promise.all([
        fetchJson<ConversationResponse>(`/${incidentId}/conversation`),
        fetchJson<MessagesResponse>(`/${incidentId}/messages`),
      ]);
      setStatus(conversation.data?.status ?? "Active");
      setMessages(thread.data ?? []);
      setReadOnly(Boolean(thread.readOnly));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load communication thread");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function sendOfficialMessage() {
    if (!body.trim() || readOnly) return;
    setSending(true);
    try {
      await fetchJson(`/${incidentId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          clientMessageId: crypto.randomUUID(),
          messageType: "OfficialNotice",
          body: body.trim(),
        }),
      });
      setBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setSending(false);
    }
  }

  async function requestInformation() {
    setSending(true);
    try {
      await fetchJson(`/${incidentId}/information-requests`, {
        method: "POST",
        body: JSON.stringify({ requestType: "situation_still_ongoing", required: true }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create information request");
    } finally {
      setSending(false);
    }
  }

  return (
    <Panel title="Incident communication">
      <div className="grid gap-3 text-sm">
        <p className="text-muted">
          Secure reporter/dispatcher thread · status <strong>{status}</strong>
          {readOnly ? " · read-only" : ""}
        </p>
        {loading ? <p>Loading messages…</p> : null}
        {error ? <p className="text-danger">{error}</p> : null}
        <ul className="grid max-h-72 gap-2 overflow-y-auto rounded-md border border-line p-3">
          {messages.length ? (
            messages.map((message) => (
              <li key={message.id} className="rounded-md bg-surface px-3 py-2">
                <p className="font-semibold">
                  {message.senderLabel} · {message.senderRole}
                </p>
                <p>{message.body}</p>
                <p className="text-muted">
                  {new Date(message.createdAt).toLocaleString()} · {message.deliveryState ?? "Sent"}
                </p>
              </li>
            ))
          ) : (
            <li className="text-muted">No messages yet.</li>
          )}
        </ul>
        {!readOnly ? (
          <div className="grid gap-2">
            <textarea
              className="min-h-20 rounded-md border border-line bg-surface px-3 py-2"
              placeholder="Send official update to reporter"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-eye px-3 py-2 text-white disabled:opacity-50"
                disabled={sending || !body.trim()}
                onClick={() => void sendOfficialMessage()}
              >
                Send official message
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 disabled:opacity-50"
                disabled={sending}
                onClick={() => void requestInformation()}
              >
                Request situation update
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
