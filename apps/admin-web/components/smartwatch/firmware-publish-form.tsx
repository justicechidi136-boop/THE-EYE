"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, InlineAlert } from "../form-primitives";

export function FirmwarePublishForm({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    version: "",
    title: "",
    releaseNotes: "",
    downloadUrl: "",
    fileHash: "",
    signature: "",
  });

  if (!canManage) {
    return <InlineAlert tone="warning">You do not have permission to publish firmware.</InlineAlert>;
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/smartwatch/firmware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: "Published" }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Publish failed");
      setMessage(`Published firmware metadata ${form.version}. No device update was initiated.`);
      setForm({ version: "", title: "", releaseNotes: "", downloadUrl: "", fileHash: "", signature: "" });
      router.refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={publish}>
      <div className="grid gap-3 lg:grid-cols-2">
        <input className="h-11 rounded-md border border-line px-3" placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} required />
        <input className="h-11 rounded-md border border-line px-3" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input className="h-11 rounded-md border border-line px-3 lg:col-span-2" placeholder="Download URL" value={form.downloadUrl} onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })} required />
        <input className="h-11 rounded-md border border-line px-3" placeholder="SHA-256 hash" value={form.fileHash} onChange={(e) => setForm({ ...form, fileHash: e.target.value })} required />
        <input className="h-11 rounded-md border border-line px-3" placeholder="Signature" value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} required />
        <textarea className="min-h-[88px] rounded-md border border-line px-3 py-2 lg:col-span-2" placeholder="Release notes" value={form.releaseNotes} onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })} />
      </div>
      <Button type="submit" disabled={busy}>Publish firmware metadata</Button>
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </form>
  );
}
