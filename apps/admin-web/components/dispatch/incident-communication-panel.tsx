"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

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



const INFORMATION_REQUEST_TYPES = [

  { value: "situation_still_ongoing", label: "Situation still ongoing" },

  { value: "safe_to_call", label: "Safe to call" },

  { value: "exact_landmark", label: "Exact landmark" },

  { value: "medical_assistance_required", label: "Medical assistance required" },

  { value: "vehicle_description", label: "Vehicle description" },

] as const;



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

  const [unreadCount, setUnreadCount] = useState(0);

  const [body, setBody] = useState("");

  const [requestType, setRequestType] = useState<string>(

    INFORMATION_REQUEST_TYPES[0].value,

  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [readOnly, setReadOnly] = useState(false);

  const [sending, setSending] = useState(false);



  const orderedMessages = useMemo(

    () => [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

    [messages],

  );



  const refresh = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const [conversation, thread] = await Promise.all([

        fetchJson<ConversationResponse>(`/${incidentId}/conversation`),

        fetchJson<MessagesResponse>(`/${incidentId}/messages`),

      ]);

      setStatus(conversation.data?.status ?? "Active");

      setUnreadCount(conversation.data?.unreadMessageCount ?? 0);

      setMessages(thread.data ?? []);

      setReadOnly(Boolean(thread.readOnly));

      for (const message of thread.data ?? []) {

        if (message.senderRole !== "Reporter") continue;

        if (message.deliveryState === "Read") continue;

        try {

          await fetchJson(`/${incidentId}/messages/${message.id}/read`, {

            method: "PATCH",

            body: "{}",

          });

        } catch {

          // Non-fatal; unread badge may lag until next refresh.

        }

      }

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

        body: JSON.stringify({ requestType, required: true }),

      });

      await refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Unable to create information request");

    } finally {

      setSending(false);

    }

  }



  async function restrictConversation() {

    const reason = window.prompt("Reason for restricting reporter text messages?");

    if (!reason?.trim()) return;

    setSending(true);

    try {

      await fetchJson(`/${incidentId}/conversation/restrict`, {

        method: "POST",

        body: JSON.stringify({ reason: reason.trim() }),

      });

      await refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Unable to restrict conversation");

    } finally {

      setSending(false);

    }

  }



  async function closeConversation() {

    const reason = window.prompt("Reason for closing the communication thread?");

    if (!reason?.trim()) return;

    setSending(true);

    try {

      await fetchJson(`/${incidentId}/conversation/close`, {

        method: "POST",

        body: JSON.stringify({ reason: reason.trim() }),

      });

      await refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Unable to close conversation");

    } finally {

      setSending(false);

    }

  }



  async function reportMessage(messageId: string) {

    const reason = window.prompt("Report reason?");

    if (!reason?.trim()) return;

    setSending(true);

    try {

      await fetchJson(`/${incidentId}/messages/${messageId}/report`, {

        method: "POST",

        body: JSON.stringify({ reason: reason.trim() }),

      });

      await refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Unable to report message");

    } finally {

      setSending(false);

    }

  }



  return (

    <Panel title="Incident communication">

      <div className="grid gap-3 text-sm">

        <p className="text-muted">

          Secure reporter/dispatcher thread · status <strong>{status}</strong>

          {unreadCount > 0 ? (

            <>

              {" "}

              · <strong>{unreadCount} unread</strong>

            </>

          ) : null}

          {readOnly ? " · read-only" : ""}

        </p>

        {loading ? <p>Loading messages…</p> : null}

        {error ? <p className="text-danger">{error}</p> : null}

        <ul className="grid max-h-72 gap-2 overflow-y-auto rounded-md border border-line p-3">

          {orderedMessages.length ? (

            orderedMessages.map((message) => (

              <li key={message.id} className="rounded-md bg-surface px-3 py-2">

                <div className="flex items-start justify-between gap-2">

                  <p className="font-semibold">

                    {message.senderLabel} · {message.senderRole}

                  </p>

                  {message.senderRole === "Reporter" ? (

                    <button

                      type="button"

                      className="text-xs text-muted underline"

                      disabled={sending}

                      onClick={() => void reportMessage(message.id)}

                    >

                      Report

                    </button>

                  ) : null}

                </div>

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

            <label className="grid gap-1">

              <span className="text-muted">Information request type</span>

              <select

                className="rounded-md border border-line bg-surface px-3 py-2"

                value={requestType}

                onChange={(event) => setRequestType(event.target.value)}

              >

                {INFORMATION_REQUEST_TYPES.map((option) => (

                  <option key={option.value} value={option.value}>

                    {option.label}

                  </option>

                ))}

              </select>

            </label>

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

                Request information

              </button>

              <button

                type="button"

                className="rounded-md border border-line px-3 py-2 disabled:opacity-50"

                disabled={sending}

                onClick={() => void restrictConversation()}

              >

                Restrict reporter text

              </button>

              <button

                type="button"

                className="rounded-md border border-line px-3 py-2 disabled:opacity-50"

                disabled={sending}

                onClick={() => void closeConversation()}

              >

                Close thread

              </button>

            </div>

          </div>

        ) : null}

      </div>

    </Panel>

  );

}

