"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, TextInput } from "./form-primitives";

const statusOptions = ["", "Submitted", "Received", "Verifying", "Verified", "Assigned", "Resolved", "Closed"];
const priorityOptions = ["", "P1LifeThreatening", "P2ActiveCrimeAccident", "P3SuspiciousActivity", "P4GeneralSafety"];
const typeOptions = ["", "Emergency", "Crime", "Accident", "Fire", "Kidnapping", "Abuse", "SuspiciousActivity", "SOS", "MissingPerson", "StolenVehicle"];

export function IncidentFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (status.trim()) params.set("status", status.trim());
    if (priority.trim()) params.set("priority", priority.trim());
    if (type.trim()) params.set("type", type.trim());
    const query = params.toString();
    router.push(query ? `/incidents?${query}` : "/incidents");
  }

  function clearFilters() {
    setStatus("");
    setPriority("");
    setType("");
    router.push("/incidents");
  }

  return (
    <div className="grid gap-3 md:grid-cols-5">
      <label className="grid gap-2 text-sm font-medium">
        Status
        <select className="rounded-md border border-line bg-surface px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}>
          {statusOptions.map((option) => (
            <option key={option || "all"} value={option}>{option || "All statuses"}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Priority
        <select className="rounded-md border border-line bg-surface px-3 py-2" value={priority} onChange={(event) => setPriority(event.target.value)}>
          {priorityOptions.map((option) => (
            <option key={option || "all"} value={option}>{option || "All priorities"}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Type
        <TextInput placeholder="Incident type" value={type} onChange={(event) => setType(event.target.value)} list="incident-type-options" />
        <datalist id="incident-type-options">
          {typeOptions.filter(Boolean).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </label>
      <Button type="button" className="self-end" onClick={applyFilters}>Apply filters</Button>
      <Button type="button" variant="secondary" className="self-end" onClick={clearFilters}>Clear</Button>
    </div>
  );
}
