"use client";

import { useMemo, useState } from "react";
import type { PoliceStationFormValues, PoliceStationDuplicate, PoliceVerificationStatus } from "../../lib/police-stations/types";
import { defaultPoliceStationFormValues } from "../../lib/police-stations/types";
import {
  buildPoliceStationPayload,
  googleMapsPreviewUrl,
  parseCoordinatePair,
  validatePoliceStationForm,
} from "../../lib/police-stations/validation";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import { Panel } from "../ui";

const verificationOptions: PoliceVerificationStatus[] = [
  "Unverified",
  "VerifiedOfficial",
  "VerifiedByAdmin",
  "Closed",
  "Duplicate",
];

type PoliceStationFormProps = {
  title: string;
  submitLabel: string;
  initialValues?: Partial<PoliceStationFormValues>;
  excludeStationId?: string;
  disabled?: boolean;
  onSubmit: (payload: Record<string, unknown>, duplicates: PoliceStationDuplicate[]) => Promise<void>;
};

export function PoliceStationForm({
  title,
  submitLabel,
  initialValues,
  excludeStationId,
  disabled = false,
  onSubmit,
}: PoliceStationFormProps) {
  const [values, setValues] = useState<PoliceStationFormValues>({
    ...defaultPoliceStationFormValues,
    ...initialValues,
  });
  const [coordinatePaste, setCoordinatePaste] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof PoliceStationFormValues, string>>>({});
  const [duplicates, setDuplicates] = useState<PoliceStationDuplicate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const previewUrl = useMemo(() => {
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return googleMapsPreviewUrl(latitude, longitude);
  }, [values.latitude, values.longitude]);

  function updateField<K extends keyof PoliceStationFormValues>(key: K, value: PoliceStationFormValues[K]) {
    setDirty(true);
    setValues((current) => ({ ...current, [key]: value }));
  }

  function applyCoordinatePaste() {
    const parsed = parseCoordinatePair(coordinatePaste);
    if (parsed.error) {
      setFormError(parsed.error);
      return;
    }
    setFormError(null);
    setValues((current) => ({
      ...current,
      latitude: String(parsed.latitude),
      longitude: String(parsed.longitude),
    }));
    setDirty(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePoliceStationForm(values);
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = buildPoliceStationPayload(values);
      const duplicateResponse = await fetch("/api/admin/police-stations/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          address: payload.address,
          latitude: payload.latitude,
          longitude: payload.longitude,
          officialPhone: payload.officialPhone,
          emergencyPhone: payload.emergencyPhone,
          sourceReference: payload.sourceReference,
          excludeId: excludeStationId,
        }),
      });
      const duplicateBody = await duplicateResponse.json() as { data?: PoliceStationDuplicate[]; message?: string };
      const matches = duplicateBody.data ?? [];
      setDuplicates(matches);
      if (matches.length && !values.duplicateOverrideReason.trim()) {
        setFormError("Possible duplicate records detected. Review matches and provide an override reason to continue.");
        return;
      }
      await onSubmit(payload, matches);
      setDirty(false);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title={title}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        {dirty ? <InlineAlert tone="warning">Unsaved changes</InlineAlert> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          <FormField label="Official name" htmlFor="station-name" error={errors.name}>
            <TextInput id="station-name" value={values.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ikeja Central Police Station" />
          </FormField>
          <FormField label="Station type" htmlFor="station-type" error={errors.stationType}>
            <SelectInput id="station-type" value={values.stationType} onChange={(event) => updateField("stationType", event.target.value)}>
              <option value="police">police</option>
              <option value="divisional">divisional</option>
              <option value="area command">area command</option>
              <option value="security">security</option>
            </SelectInput>
          </FormField>
          <FormField label="Country" htmlFor="station-country" error={errors.country}>
            <TextInput id="station-country" value={values.country} onChange={(event) => updateField("country", event.target.value)} />
          </FormField>
          <FormField label="State" htmlFor="station-state" error={errors.state}>
            <TextInput id="station-state" value={values.state} onChange={(event) => updateField("state", event.target.value)} />
          </FormField>
          <FormField label="LGA" htmlFor="station-lga" error={errors.lga}>
            <TextInput id="station-lga" value={values.lga} onChange={(event) => updateField("lga", event.target.value)} />
          </FormField>
          <FormField label="Verification status" htmlFor="station-status" error={errors.verificationStatus}>
            <SelectInput
              id="station-status"
              value={values.verificationStatus}
              onChange={(event) => updateField("verificationStatus", event.target.value as PoliceVerificationStatus)}
            >
              {verificationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectInput>
          </FormField>
        </div>

        <FormField label="Address" htmlFor="station-address" error={errors.address}>
          <TextInput id="station-address" value={values.address} onChange={(event) => updateField("address", event.target.value)} placeholder="Street, LGA, State" />
        </FormField>

        <div className="grid gap-3 lg:grid-cols-3">
          <FormField label="Latitude" htmlFor="station-latitude" error={errors.latitude}>
            <TextInput id="station-latitude" value={values.latitude} onChange={(event) => updateField("latitude", event.target.value)} placeholder="6.601800" />
          </FormField>
          <FormField label="Longitude" htmlFor="station-longitude" error={errors.longitude}>
            <TextInput id="station-longitude" value={values.longitude} onChange={(event) => updateField("longitude", event.target.value)} placeholder="3.351500" />
          </FormField>
          <FormField label="Paste coordinates" htmlFor="station-coords" hint="Format: latitude, longitude">
            <div className="flex gap-2">
              <TextInput id="station-coords" value={coordinatePaste} onChange={(event) => setCoordinatePaste(event.target.value)} placeholder="6.6018, 3.3515" />
              <Button type="button" variant="secondary" onClick={applyCoordinatePaste}>Apply</Button>
            </div>
          </FormField>
        </div>

        {previewUrl ? (
          <p className="text-sm text-muted">
            Map preview: <a className="font-semibold text-eye underline" href={previewUrl} target="_blank" rel="noreferrer">Open in Google Maps</a>
          </p>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <FormField label="Official phone" htmlFor="station-official-phone">
            <TextInput id="station-official-phone" value={values.officialPhone} onChange={(event) => updateField("officialPhone", event.target.value)} placeholder="08012345678" />
          </FormField>
          <FormField label="Emergency phone" htmlFor="station-emergency-phone">
            <TextInput id="station-emergency-phone" value={values.emergencyPhone} onChange={(event) => updateField("emergencyPhone", event.target.value)} placeholder="112" />
          </FormField>
          <FormField label="Source" htmlFor="station-source" error={errors.source} hint="Independent official source only for verified records">
            <TextInput id="station-source" value={values.source} onChange={(event) => updateField("source", event.target.value)} placeholder="NPF Lagos directory" />
          </FormField>
          <FormField label="Source reference" htmlFor="station-source-ref" error={errors.sourceReference}>
            <TextInput id="station-source-ref" value={values.sourceReference} onChange={(event) => updateField("sourceReference", event.target.value)} placeholder="Directory page, memo ID, or URL" />
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={values.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
          Active station
        </label>

        {duplicates.length ? (
          <InlineAlert tone="warning">
            <span className="block font-semibold">Possible duplicates</span>
            <ul className="mt-2 list-disc pl-5">
              {duplicates.map((duplicate) => (
                <li key={duplicate.id}>{duplicate.name} — {duplicate.matchReasons.join(", ")}</li>
              ))}
            </ul>
          </InlineAlert>
        ) : null}

        {duplicates.length ? (
          <FormField label="Duplicate override reason" htmlFor="duplicate-override" error={errors.duplicateOverrideReason}>
            <TextInput
              id="duplicate-override"
              value={values.duplicateOverrideReason}
              onChange={(event) => updateField("duplicateOverrideReason", event.target.value)}
              placeholder="Explain why this record is not a duplicate"
            />
          </FormField>
        ) : null}

        {formError ? <InlineAlert tone="error">{formError}</InlineAlert> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={disabled || submitting}>{submitting ? "Saving…" : submitLabel}</Button>
        </div>
      </form>
    </Panel>
  );
}
