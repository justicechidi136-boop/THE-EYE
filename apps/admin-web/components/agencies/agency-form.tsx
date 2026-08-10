"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AGENCY_CAPABILITIES,
  AGENCY_JURISDICTION_LEVELS,
  AGENCY_TYPES,
  AgencyType,
} from "@the-eye/shared";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import type { AgencyView } from "../../lib/types/admin-views";

type AgencyFormProps = {
  mode: "create" | "edit";
  agency?: AgencyView;
  parentOptions: AgencyView[];
};

function formatAgencyType(type: string) {
  return type.replace(/_/g, " ");
}

function formatCapability(capability: string) {
  return capability.replace(/_/g, " ");
}

export function AgencyForm({ mode, agency, parentOptions }: AgencyFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(agency?.code ?? "");
  const [name, setName] = useState(agency?.name ?? "");
  const [shortName, setShortName] = useState(agency?.shortName ?? "");
  const [type, setType] = useState(agency?.agencyType || AgencyType.Police);
  const [jurisdictionLevel, setJurisdictionLevel] = useState(agency?.jurisdictionLevel || "STATE");
  const [countryCode, setCountryCode] = useState(agency?.countryCode || "NG");
  const [stateCode, setStateCode] = useState(agency?.stateCode ?? "");
  const [lgaCode, setLgaCode] = useState(agency?.lgaCode ?? "");
  const [parentAgencyId, setParentAgencyId] = useState(agency?.parentAgencyId ?? "");
  const [capabilities, setCapabilities] = useState<string[]>(agency?.capabilities ?? []);
  const [isDispatchable, setIsDispatchable] = useState(agency?.isDispatchable ?? true);
  const [isFieldOperationsEnabled, setIsFieldOperationsEnabled] = useState(agency?.isFieldOperationsEnabled ?? false);
  const [isDroneEnabled, setIsDroneEnabled] = useState(agency?.isDroneEnabled ?? false);
  const [isBroadcastAuthority, setIsBroadcastAuthority] = useState(agency?.isBroadcastAuthority ?? false);
  const [isGovernment, setIsGovernment] = useState(agency?.isGovernment ?? true);
  const [isEmergencyResponder, setIsEmergencyResponder] = useState(agency?.isEmergencyResponder ?? true);
  const [phone, setPhone] = useState(agency?.phone ?? "");
  const [email, setEmail] = useState(agency?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!agency) return;
    setCode(agency.code);
    setName(agency.name);
    setShortName(agency.shortName ?? "");
    setType(agency.agencyType || AgencyType.Police);
    setJurisdictionLevel(agency.jurisdictionLevel || "STATE");
    setCountryCode(agency.countryCode || "NG");
    setStateCode(agency.stateCode ?? "");
    setLgaCode(agency.lgaCode ?? "");
    setParentAgencyId(agency.parentAgencyId ?? "");
    setCapabilities(agency.capabilities ?? []);
    setIsDispatchable(agency.isDispatchable);
    setIsFieldOperationsEnabled(agency.isFieldOperationsEnabled);
    setIsDroneEnabled(agency.isDroneEnabled);
    setIsBroadcastAuthority(agency.isBroadcastAuthority);
    setIsGovernment(agency.isGovernment);
    setIsEmergencyResponder(agency.isEmergencyResponder);
    setPhone(agency.phone ?? "");
    setEmail(agency.email ?? "");
  }, [agency]);

  function toggleCapability(capability: string) {
    setCapabilities((current) =>
      current.includes(capability) ? current.filter((item) => item !== capability) : [...current, capability],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === "create" && !code.trim()) {
      setError("Code is required.");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!countryCode.trim()) {
      setError("Country code is required.");
      return;
    }

    setSubmitting(true);
    try {
      const path = mode === "create" ? "/api/admin/agencies" : `/api/admin/agencies/${encodeURIComponent(agency?.id ?? "")}`;
      const body =
        mode === "create"
          ? {
              code: code.trim(),
              name: name.trim(),
              shortName: shortName.trim() || undefined,
              type,
              jurisdictionLevel,
              countryCode: countryCode.trim().toUpperCase(),
              stateCode: stateCode.trim() || undefined,
              lgaCode: lgaCode.trim() || undefined,
              parentAgencyId: parentAgencyId || undefined,
              capabilities,
              isDispatchable,
              isFieldOperationsEnabled,
              isDroneEnabled,
              isBroadcastAuthority,
              isGovernment,
              isEmergencyResponder,
              phone: phone.trim() || undefined,
              email: email.trim() || undefined,
            }
          : {
              name: name.trim(),
              shortName: shortName.trim() || null,
              type,
              jurisdictionLevel,
              countryCode: countryCode.trim().toUpperCase(),
              stateCode: stateCode.trim() || null,
              lgaCode: lgaCode.trim() || null,
              parentAgencyId: parentAgencyId || null,
              capabilities,
              isDispatchable,
              isFieldOperationsEnabled,
              isDroneEnabled,
              isBroadcastAuthority,
              isGovernment,
              isEmergencyResponder,
              phone: phone.trim() || null,
              email: email.trim() || null,
            };

      const response = await fetch(path, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { data?: { id?: string }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to save agency");
      setMessage(mode === "create" ? "Agency created." : "Agency updated.");
      const id = payload.data?.id ?? agency?.id;
      if (id) {
        router.push(`/agencies/${id}`);
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save agency");
    } finally {
      setSubmitting(false);
    }
  }

  const selectableParents = parentOptions.filter((option) => option.id !== agency?.id);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Code" htmlFor="agency-code" hint={mode === "create" ? "Stable agency code, e.g. NPFR-LA." : "Code cannot be changed after creation."}>
          <TextInput
            id="agency-code"
            value={code}
            disabled={mode === "edit"}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="NPFR-LA"
          />
        </FormField>
        <FormField label="Name" htmlFor="agency-name">
          <TextInput id="agency-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nigeria Police Force — Lagos" />
        </FormField>
        <FormField label="Short name" htmlFor="agency-short-name">
          <TextInput id="agency-short-name" value={shortName} onChange={(event) => setShortName(event.target.value)} placeholder="NPF Lagos" />
        </FormField>
        <FormField label="Agency type" htmlFor="agency-type">
          <SelectInput id="agency-type" value={type} onChange={(event) => setType(event.target.value)}>
            {AGENCY_TYPES.map((agencyType) => (
              <option key={agencyType} value={agencyType}>
                {formatAgencyType(agencyType)}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Jurisdiction level" htmlFor="agency-jurisdiction-level">
          <SelectInput
            id="agency-jurisdiction-level"
            value={jurisdictionLevel}
            onChange={(event) => setJurisdictionLevel(event.target.value)}
          >
            {AGENCY_JURISDICTION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Parent agency" htmlFor="agency-parent" hint="Optional — select by name/code, not UUID.">
          <SelectInput id="agency-parent" value={parentAgencyId} onChange={(event) => setParentAgencyId(event.target.value)}>
            <option value="">None</option>
            {selectableParents.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.code})
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Country code" htmlFor="agency-country">
          <SelectInput id="agency-country" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
            <option value="NG">NG — Nigeria</option>
          </SelectInput>
        </FormField>
        <FormField label="State code" htmlFor="agency-state">
          <TextInput id="agency-state" value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase())} placeholder="LA" />
        </FormField>
        <FormField label="LGA code" htmlFor="agency-lga">
          <TextInput id="agency-lga" value={lgaCode} onChange={(event) => setLgaCode(event.target.value.toUpperCase())} />
        </FormField>
        <FormField label="Phone" htmlFor="agency-phone">
          <TextInput id="agency-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="agency-email">
          <TextInput id="agency-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Capabilities</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AGENCY_CAPABILITIES.map((capability) => (
            <label key={capability} className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={capabilities.includes(capability)}
                onChange={() => toggleCapability(capability)}
              />
              <span>{formatCapability(capability)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <input type="checkbox" checked={isDispatchable} onChange={(event) => setIsDispatchable(event.target.checked)} />
          Dispatchable
        </label>
        <label className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={isFieldOperationsEnabled}
            onChange={(event) => setIsFieldOperationsEnabled(event.target.checked)}
          />
          Field operations enabled
        </label>
        <label className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <input type="checkbox" checked={isDroneEnabled} onChange={(event) => setIsDroneEnabled(event.target.checked)} />
          Drone enabled
        </label>
        <label className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={isBroadcastAuthority}
            onChange={(event) => setIsBroadcastAuthority(event.target.checked)}
          />
          Broadcast authority
        </label>
        <label className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <input type="checkbox" checked={isGovernment} onChange={(event) => setIsGovernment(event.target.checked)} />
          Government agency
        </label>
        <label className="flex items-center gap-2 rounded-md border border-line bg-surfaceMuted px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={isEmergencyResponder}
            onChange={(event) => setIsEmergencyResponder(event.target.checked)}
          />
          Emergency responder
        </label>
      </div>

      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : mode === "create" ? "Create agency" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
