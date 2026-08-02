"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import { Panel } from "../ui";

type DroneOperatorFormValues = {
  name: string;
  email: string;
  phone: string;
  callsign: string;
  operatorCode: string;
  operatorRole: string;
  certificationLevel: string;
  accountStatus: string;
  availabilityStatus: string;
  country: string;
  state: string;
  lga: string;
  assignedOperatingBase: string;
  isActive: boolean;
};

type DroneOperatorFormProps = {
  mode: "create" | "edit";
  operatorId?: string;
  initialValues?: Partial<DroneOperatorFormValues>;
};

const defaultValues: DroneOperatorFormValues = {
  name: "",
  email: "",
  phone: "",
  callsign: "",
  operatorCode: "",
  operatorRole: "Operator",
  certificationLevel: "",
  accountStatus: "Active",
  availabilityStatus: "Available",
  country: "",
  state: "",
  lga: "",
  assignedOperatingBase: "",
  isActive: true,
};

function toPayload(values: DroneOperatorFormValues) {
  return {
    name: values.name.trim(),
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    callsign: values.callsign.trim() || null,
    operatorCode: values.operatorCode.trim() || null,
    operatorRole: values.operatorRole.trim(),
    certificationLevel: values.certificationLevel.trim() || null,
    accountStatus: values.accountStatus,
    availabilityStatus: values.availabilityStatus,
    country: values.country.trim() || null,
    state: values.state.trim() || null,
    lga: values.lga.trim() || null,
    assignedOperatingBase: values.assignedOperatingBase.trim() || null,
    isActive: values.isActive,
  };
}

export function DroneOperatorForm({ mode, operatorId, initialValues }: DroneOperatorFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<DroneOperatorFormValues>({ ...defaultValues, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function updateField<K extends keyof DroneOperatorFormValues>(field: K, value: DroneOperatorFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("Operator name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const path =
        mode === "create"
          ? "/api/admin/drone-surveillance/operators"
          : `/api/admin/drone-surveillance/operators/${encodeURIComponent(operatorId ?? "")}`;
      const response = await fetch(path, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; data?: { id?: string } } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Failed to save operator");
      const id = payload?.data?.id ?? operatorId;
      setMessage(mode === "create" ? "Operator created." : "Operator updated.");
      if (id) {
        router.push(`/drone-surveillance/operators/${id}`);
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save operator");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title={mode === "create" ? "New drone operator" : "Edit drone operator"}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Full name" htmlFor="operator-name">
            <TextInput id="operator-name" value={values.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ada Eze" />
          </FormField>
          <FormField label="Operator code" htmlFor="operator-code">
            <TextInput id="operator-code" value={values.operatorCode} onChange={(event) => updateField("operatorCode", event.target.value)} placeholder="DOP-102" />
          </FormField>
          <FormField label="Callsign" htmlFor="operator-callsign">
            <TextInput id="operator-callsign" value={values.callsign} onChange={(event) => updateField("callsign", event.target.value)} placeholder="Falcon-12" />
          </FormField>
          <FormField label="Role" htmlFor="operator-role">
            <SelectInput id="operator-role" value={values.operatorRole} onChange={(event) => updateField("operatorRole", event.target.value)}>
              <option value="Operator">Operator</option>
              <option value="Commander">Commander</option>
              <option value="Observer">Observer</option>
            </SelectInput>
          </FormField>
          <FormField label="Email" htmlFor="operator-email">
            <TextInput id="operator-email" type="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} placeholder="operator@the-eye.ng" />
          </FormField>
          <FormField label="Phone" htmlFor="operator-phone">
            <TextInput id="operator-phone" value={values.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+2348012345678" />
          </FormField>
          <FormField label="Certification level" htmlFor="operator-cert">
            <TextInput id="operator-cert" value={values.certificationLevel} onChange={(event) => updateField("certificationLevel", event.target.value)} placeholder="BVLOS Level 2" />
          </FormField>
          <FormField label="Operating base" htmlFor="operator-base">
            <TextInput id="operator-base" value={values.assignedOperatingBase} onChange={(event) => updateField("assignedOperatingBase", event.target.value)} placeholder="Lagos North Command" />
          </FormField>
          <FormField label="Country" htmlFor="operator-country">
            <TextInput id="operator-country" value={values.country} onChange={(event) => updateField("country", event.target.value)} />
          </FormField>
          <FormField label="State" htmlFor="operator-state">
            <TextInput id="operator-state" value={values.state} onChange={(event) => updateField("state", event.target.value)} />
          </FormField>
          <FormField label="LGA" htmlFor="operator-lga">
            <TextInput id="operator-lga" value={values.lga} onChange={(event) => updateField("lga", event.target.value)} />
          </FormField>
          <FormField label="Account status" htmlFor="operator-account-status">
            <SelectInput id="operator-account-status" value={values.accountStatus} onChange={(event) => updateField("accountStatus", event.target.value)}>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
            </SelectInput>
          </FormField>
          <FormField label="Availability" htmlFor="operator-availability-status">
            <SelectInput id="operator-availability-status" value={values.availabilityStatus} onChange={(event) => updateField("availabilityStatus", event.target.value)}>
              <option value="Available">Available</option>
              <option value="OnMission">On mission</option>
              <option value="Unavailable">Unavailable</option>
              <option value="OffDuty">Off duty</option>
            </SelectInput>
          </FormField>
        </div>

        <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={values.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
          Operator active
        </label>

        {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : mode === "create" ? "Create operator" : "Save changes"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
