"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { AuditLogView } from "../lib/types/admin-views";
import { Button, TextInput } from "./form-primitives";

export function AuditFilter({ logs }: { logs: AuditLogView[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [action, setAction] = useState(searchParams.get("action") ?? "");
  const [entityType, setEntityType] = useState(searchParams.get("entityType") ?? "");
  const [entityId, setEntityId] = useState(searchParams.get("entityId") ?? "");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (action && !log.action.toLowerCase().includes(action.toLowerCase())) return false;
      if (entityType && !log.entity.toLowerCase().includes(entityType.toLowerCase())) return false;
      if (entityId && !log.entity.toLowerCase().includes(entityId.toLowerCase())) return false;
      return true;
    });
  }, [action, entityId, entityType, logs]);

  function applyServerFilters() {
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    if (entityType.trim()) params.set("entityType", entityType.trim());
    if (entityId.trim()) params.set("entityId", entityId.trim());
    const query = params.toString();
    router.push(query ? `/audit?${query}` : "/audit");
  }

  function clearFilters() {
    setAction("");
    setEntityType("");
    setEntityId("");
    router.push("/audit");
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-5">
        <label className="grid gap-2 text-sm font-medium">
          Action
          <TextInput placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Entity type
          <TextInput placeholder="Entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Entity ID
          <TextInput placeholder="Entity ID" value={entityId} onChange={(event) => setEntityId(event.target.value)} />
        </label>
        <Button type="button" className="self-end" onClick={applyServerFilters}>
          Apply API filters
        </Button>
        <Button type="button" variant="secondary" className="self-end" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
      <p className="text-sm text-muted">Showing {filtered.length} of {logs.length} ledger events.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-surfaceMuted text-xs uppercase text-muted">
            <tr><th className="px-4 py-3">Seq</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Previous hash</th><th className="px-4 py-3">Event hash</th><th className="px-4 py-3">Chain</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((log) => (
              <tr key={log.sequence}>
                <td className="px-4 py-3 font-semibold">{log.sequence}</td>
                <td className="px-4 py-3">{log.time}</td>
                <td className="px-4 py-3">{log.actor}</td>
                <td className="px-4 py-3">{log.action}</td>
                <td className="px-4 py-3 font-semibold">{log.entity}</td>
                <td className="px-4 py-3 text-muted">{log.reason}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.previousHash}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.eventHash}</td>
                <td className="px-4 py-3">{log.chain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
