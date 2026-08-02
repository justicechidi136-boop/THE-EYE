"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, FormField, InlineAlert, TextInput } from "../form-primitives";

const roleOptions = [
  { label: "Drone Operator", value: "Operator" },
  { label: "Drone Commander", value: "Commander" },
];

export function AddDroneOperatorForm() {
  const router = useRouter();
  const nameId = useId();
  const emailId = useId();
  const callsignId = useId();
  const roleId = useId();
  const certificationId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [callsign, setCallsign] = useState("");
  const [operatorRole, setOperatorRole] = useState(roleOptions[0].value);
  const [certificationLevel, setCertificationLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Operator name is required.");
      setMessage(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/drone-surveillance/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          callsign: callsign.trim() || undefined,
          operatorRole,
          certificationLevel: certificationLevel.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to add operator");
      }
      setName("");
      setEmail("");
      setCallsign("");
      setCertificationLevel("");
      setMessage("Operator registered successfully.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add operator");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Full name" htmlFor={nameId}>
          <TextInput id={nameId} value={name} onChange={(event) => setName(event.target.value)} placeholder="Operator full name" required />
        </FormField>
        <FormField label="Email" htmlFor={emailId}>
          <TextInput id={emailId} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@agency.gov" />
        </FormField>
        <FormField label="Callsign" htmlFor={callsignId}>
          <TextInput id={callsignId} value={callsign} onChange={(event) => setCallsign(event.target.value)} placeholder="EAGLE-01" />
        </FormField>
        <FormField label="Role" htmlFor={roleId}>
          <select
            id={roleId}
            className="h-[43px] w-full rounded-lg border-2 border-stroke bg-surface px-3 text-sm text-ink"
            value={operatorRole}
            onChange={(event) => setOperatorRole(event.target.value)}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Certification level" htmlFor={certificationId}>
          <TextInput id={certificationId} value={certificationLevel} onChange={(event) => setCertificationLevel(event.target.value)} placeholder="Advanced RPAS / Night ops" />
        </FormField>
      </div>
      {error ? <InlineAlert><span>{error}</span></InlineAlert> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <div>
        <Button type="submit" disabled={submitting}>{submitting ? "Adding operator..." : "Add operator"}</Button>
      </div>
    </form>
  );
}
