"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";

type AccountType = "field_officer" | "lga_admin";
type Options = {
  accountTypes: AccountType[];
  jurisdictions: Array<{ id: string; country: string; state: string; lga: string; name: string }>;
  agencies: Array<{
    id: string;
    name: string;
    countryCode: string;
    stateCode: string | null;
    lgaCode: string | null;
    jurisdictionId: string | null;
  }>;
};

export function OperationalAccountForm() {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [accountType, setAccountType] = useState<AccountType>("field_officer");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/operational-accounts");
        const payload = (await response.json()) as { data?: Options; message?: string };
        if (!response.ok || !payload.data) throw new Error(payload.message ?? "Unable to load account options");
        if (!cancelled) {
          setOptions(payload.data);
          setAccountType(payload.data.accountTypes[0] ?? "field_officer");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load account options");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lgaJurisdictions = useMemo(
    () => options?.jurisdictions.filter((item) => item.lga && item.lga !== "All") ?? [],
    [options],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (accountType === "field_officer" && !agencyId) {
      setError("Select the officer's field-operations agency.");
      return;
    }
    if (accountType === "lga_admin" && !jurisdictionId) {
      setError("Select the Sub-State (LGA) jurisdiction.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/operational-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          agencyId: accountType === "field_officer" ? agencyId : undefined,
          jurisdictionId: accountType === "lga_admin" ? jurisdictionId : undefined,
        }),
      });
      const payload = (await response.json()) as { data?: { id?: string }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to create account");
      router.push("/users?kind=admin");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading account options...</p>;
  if (!options?.accountTypes.length) return <InlineAlert>You do not have permission to create operational accounts.</InlineAlert>;

  return (
    <form className="grid max-w-3xl gap-5" onSubmit={handleSubmit}>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <FormField label="Account type" htmlFor="account-type">
        <SelectInput
          id="account-type"
          value={accountType}
          onChange={(event) => setAccountType(event.target.value as AccountType)}
        >
          {options.accountTypes.includes("field_officer") ? <option value="field_officer">Field Officer</option> : null}
          {options.accountTypes.includes("lga_admin") ? <option value="lga_admin">Sub-State Admin (LGA Admin)</option> : null}
        </SelectInput>
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Full name" htmlFor="account-name">
          <TextInput id="account-name" required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </FormField>
        <FormField label="Email address" htmlFor="account-email">
          <TextInput id="account-email" required type="email" autoComplete="off" maxLength={240} value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
        <FormField label="Initial password" htmlFor="account-password" hint="At least 12 characters. Share through an approved secure channel.">
          <TextInput id="account-password" required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
        </FormField>
        <FormField label="Confirm password" htmlFor="account-password-confirm">
          <TextInput id="account-password-confirm" required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </FormField>
      </div>
      {accountType === "field_officer" ? (
        <FormField label="Field operations agency" htmlFor="account-agency">
          <SelectInput id="account-agency" required value={agencyId} onChange={(event) => setAgencyId(event.target.value)}>
            <option value="">Select agency</option>
            {options.agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>{agency.name} - {[agency.stateCode, agency.lgaCode].filter(Boolean).join(" / ")}</option>
            ))}
          </SelectInput>
        </FormField>
      ) : (
        <FormField label="Sub-State jurisdiction" htmlFor="account-jurisdiction">
          <SelectInput id="account-jurisdiction" required value={jurisdictionId} onChange={(event) => setJurisdictionId(event.target.value)}>
            <option value="">Select LGA</option>
            {lgaJurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.id} value={jurisdiction.id}>{jurisdiction.name} - {jurisdiction.state} / {jurisdiction.lga}</option>
            ))}
          </SelectInput>
        </FormField>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.push("/users")}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Creating account..." : "Create account"}</Button>
      </div>
    </form>
  );
}
