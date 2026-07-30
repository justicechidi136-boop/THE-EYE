"use client";

import { useState } from "react";

type Props = {
  disabled?: boolean;
};

export function StagingWatchTestAlertForm({ disabled = false }: Props) {
  const [userId, setUserId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [languageHint, setLanguageHint] = useState("en-NG");
  const [priority, setPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM">("CRITICAL");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!userId.trim()) {
      setStatus("userId is required");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/watch-notifications/staging/test-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          deviceId: deviceId.trim() || undefined,
          languageHint,
          priority,
          alertCode: "DANGER_ZONE_GENERAL_ENTRY",
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setStatus(body.message ?? "Test alert failed");
        return;
      }
      setStatus(`Queued: ${JSON.stringify(body)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Test alert failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-ink">User ID</span>
        <input
          className="rounded-md border border-line px-3 py-2"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          disabled={disabled || loading}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-ink">Watch device ID (optional)</span>
        <input
          className="rounded-md border border-line px-3 py-2"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          disabled={disabled || loading}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-ink">Language</span>
        <select
          className="rounded-md border border-line px-3 py-2"
          value={languageHint}
          onChange={(event) => setLanguageHint(event.target.value)}
          disabled={disabled || loading}
        >
          <option value="en-NG">English (en-NG)</option>
          <option value="pcm-NG">Nigerian Pidgin (pcm-NG)</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-ink">Priority</span>
        <select
          className="rounded-md border border-line px-3 py-2"
          value={priority}
          onChange={(event) => setPriority(event.target.value as typeof priority)}
          disabled={disabled || loading}
        >
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
        </select>
      </label>
      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={disabled || loading}
        >
          {loading ? "Sending…" : "Send staging test alert"}
        </button>
        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </div>
    </form>
  );
}
