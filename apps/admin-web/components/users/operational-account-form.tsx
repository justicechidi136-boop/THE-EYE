"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, InlineAlert, SelectInput, TextInput } from "../form-primitives";
import { formatJurisdiction } from "../../lib/admin-presentation";

type AccountType = "field_officer" | "sub_state_admin" | "state_admin" | "agency_admin";
type CommunityOption = { id: string; parentId: string | null; jurisdictionId: string | null; name: string; level: string; country: string; state: string | null; lga: string | null };
type Options = {
  accountTypes: AccountType[];
  jurisdictions: Array<{ id: string; country: string; state: string; lga: string; name: string }>;
  communities: CommunityOption[];
  agencies: Array<{ id: string; name: string; stateCode: string | null; lgaCode: string | null; jurisdictionId: string | null; isFieldOperationsEnabled: boolean }>;
};

const stepNames = ["Account type", "Organisation", "Operational scope", "Access & Scope", "Identity", "Authentication", "Review"];
const roleDetails: Record<AccountType, { title: string; detail: string }> = {
  field_officer: { title: "Field Officer", detail: "Operational responder assigned to an agency. Access is built around assigned emergencies." },
  sub_state_admin: { title: "Sub-State Admin", detail: "Administers a specific LGA or community within the selected jurisdiction." },
  state_admin: { title: "State Admin", detail: "Administers an entire state across authorized operational modules." },
  agency_admin: { title: "Agency / Admin", detail: "Manages an agency's operations and assigned emergencies." },
};
const accessByRole: Record<AccountType, string[]> = {
  field_officer: ["Emergency Queue", "Assigned Emergencies", "Incident Details", "Response Tools", "Live Location", "Assigned Reports"],
  sub_state_admin: ["Reports", "Broadcasts", "Emergencies", "Users", "LGA and community scope"],
  state_admin: ["Reports", "Broadcasts", "Emergencies", "Users", "State-wide scope"],
  agency_admin: ["Agency operations", "Dispatch workspace", "Assigned emergencies", "Agency users"],
};

export function OperationalAccountForm() {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState<AccountType>("field_officer");
  const [agencyId, setAgencyId] = useState("");
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [cityId, setCityId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/operational-accounts")
      .then(async (response) => {
        const payload = await response.json() as { data?: Options; message?: string };
        if (!response.ok || !payload.data) throw new Error(payload.message ?? "Unable to load account options");
        if (!cancelled) {
          const accountTypes = payload.data.accountTypes.map((value) => value === ("lga_admin" as AccountType) ? "sub_state_admin" : value);
          setOptions({
            ...payload.data,
            accountTypes,
            communities: payload.data.communities ?? [],
            agencies: payload.data.agencies ?? [],
            jurisdictions: payload.data.jurisdictions ?? [],
          });
          setAccountType(accountTypes[0] ?? "field_officer");
        }
      })
      .catch((loadError) => !cancelled && setError(loadError instanceof Error ? loadError.message : "Unable to load account options"));
    return () => { cancelled = true; };
  }, []);

  const selectedAgency = options?.agencies.find((item) => item.id === agencyId);
  const selectedJurisdiction = options?.jurisdictions.find((item) => item.id === (selectedAgency?.jurisdictionId ?? jurisdictionId));
  const cities = useMemo(() => options?.communities.filter((item) => item.jurisdictionId === jurisdictionId && item.level === "CityTown") ?? [], [options, jurisdictionId]);
  const communities = useMemo(() => options?.communities.filter((item) =>
    item.jurisdictionId === jurisdictionId
    && ["Community", "Estate", "Street"].includes(item.level)
    && (!cityId || item.parentId === cityId),
  ) ?? [], [options, jurisdictionId, cityId]);
  const availableAgencies = options?.agencies.filter((agency) => accountType !== "field_officer" || agency.isFieldOperationsEnabled !== false) ?? [];

  function chooseRole(value: AccountType) {
    setAccountType(value);
    setAgencyId("");
    setJurisdictionId("");
    setCityId("");
    setCommunityId("");
    setError(null);
  }

  function validateCurrentStep() {
    if (step === 1 && ["field_officer", "agency_admin"].includes(accountType) && !agencyId) return "Select an organisation.";
    if (step === 2 && ["sub_state_admin", "state_admin"].includes(accountType) && !jurisdictionId) return "Select a jurisdiction.";
    if (step === 4 && displayName.trim().length < 2) return "Enter the account holder's full name.";
    if (step === 4 && !/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email address.";
    return null;
  }

  function next() {
    const validation = validateCurrentStep();
    if (validation) return setError(validation);
    setError(null);
    setStep((value) => Math.min(6, value + 1));
  }

  async function createAccount() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/operational-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          displayName: displayName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          agencyId: ["field_officer", "agency_admin"].includes(accountType) ? agencyId : undefined,
          jurisdictionId: ["sub_state_admin", "state_admin"].includes(accountType) ? jurisdictionId : undefined,
          communityId: accountType === "sub_state_admin" && communityId ? communityId : undefined,
        }),
      });
      const payload = await response.json() as { data?: { id: string; status: string }; message?: string };
      if (!response.ok || !payload.data) throw new Error(payload.message ?? "Unable to create account");
      setResult(payload.data);
      setStep(7);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  }

  if (!options && !error) return <p className="text-sm text-muted">Loading account options...</p>;
  if (!options) return <InlineAlert>{error ?? "Unable to load account options"}</InlineAlert>;
  if (!options.accountTypes.length) return <InlineAlert>You do not have permission to create operational accounts.</InlineAlert>;

  const scopeText = formatJurisdiction([
    selectedJurisdiction?.country,
    selectedJurisdiction?.state,
    selectedJurisdiction?.lga === "All" ? null : selectedJurisdiction?.lga,
    options.communities.find((item) => item.id === cityId)?.name,
    options.communities.find((item) => item.id === communityId)?.name,
  ], "Derived from selected organisation");

  return (
    <div className="grid min-w-0 max-w-full gap-6">
      {step < 7 ? (
        <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1">
          <ol className="flex min-w-max gap-2" aria-label="Account creation progress">
            {stepNames.map((name, index) => (
              <li
                key={name}
                aria-current={index === step ? "step" : undefined}
                className={`grid min-h-24 w-32 shrink-0 content-center rounded-md border px-3 py-4 text-center transition-colors ${
                  index === step
                    ? "border-info bg-info text-white"
                    : index < step
                      ? "border-info/50 bg-info/10 text-ink"
                      : "border-line bg-surfaceMuted text-muted"
                }`}
              >
                <span className="text-lg font-bold leading-none">{index + 1}</span>
                <span className="mt-2 text-sm font-semibold leading-snug">{name}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {step === 0 ? <section className="min-w-0"><h2 className="text-xl font-semibold text-ink">Choose account type</h2><div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">{options.accountTypes.map((value) => <button key={value} type="button" onClick={() => chooseRole(value)} className={`min-h-28 min-w-0 rounded-md border p-4 text-left ${accountType === value ? "border-eye bg-eye/10" : "border-line bg-surfaceMuted hover:border-eye"}`}><strong className="text-ink">{roleDetails[value].title}</strong><span className="mt-2 block break-words text-sm text-muted">{roleDetails[value].detail}</span></button>)}</div></section> : null}

      {step === 1 ? <section><h2 className="text-xl font-semibold text-ink">Organisation</h2><p className="mt-1 text-sm text-muted">Organisation choices adapt to the selected role.</p><div className="mt-4">{["field_officer", "agency_admin"].includes(accountType) ? <FormField label={accountType === "field_officer" ? "Field operations agency" : "Agency / organisation"} htmlFor="account-agency"><SelectInput id="account-agency" value={agencyId} onChange={(event) => setAgencyId(event.target.value)}><option value="">Select organisation</option>{availableAgencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}</SelectInput></FormField> : <div className="border-y border-line py-4"><p className="font-medium text-ink">{accountType === "state_admin" ? "State administration" : "Sub-State administration"}</p><p className="mt-1 text-sm text-muted">The operational organisation is derived from the jurisdiction selected next.</p></div>}</div></section> : null}

      {step === 2 ? <section><h2 className="text-xl font-semibold text-ink">Operational scope</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{["sub_state_admin", "state_admin"].includes(accountType) ? <FormField label={accountType === "state_admin" ? "State" : "LGA / Area Council"} htmlFor="account-jurisdiction"><SelectInput id="account-jurisdiction" value={jurisdictionId} onChange={(event) => { setJurisdictionId(event.target.value); setCityId(""); setCommunityId(""); }}><option value="">Select jurisdiction</option>{options.jurisdictions.filter((item) => accountType === "state_admin" ? item.state !== "All" && item.lga === "All" : item.lga !== "All").map((item) => <option key={item.id} value={item.id}>{formatJurisdiction([item.country, item.state, item.lga === "All" ? null : item.lga])}</option>)}</SelectInput></FormField> : <div className="md:col-span-2 border-y border-line py-4"><p className="font-medium text-ink">{scopeText}</p><p className="mt-1 text-sm text-muted">Jurisdiction is securely derived from the selected agency.</p></div>}{accountType === "sub_state_admin" ? <><FormField label="City / Town (optional)" htmlFor="account-city"><SelectInput id="account-city" value={cityId} disabled={!jurisdictionId || cities.length === 0} onChange={(event) => { setCityId(event.target.value); setCommunityId(""); }}><option value="">All cities / towns in LGA</option>{cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></FormField><FormField label="Community / Neighborhood (optional)" htmlFor="account-community"><SelectInput id="account-community" value={communityId} disabled={!jurisdictionId || communities.length === 0} onChange={(event) => setCommunityId(event.target.value)}><option value="">All communities in scope</option>{communities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></FormField></> : null}</div></section> : null}

      {step === 3 ? <section><h2 className="text-xl font-semibold text-ink">Access &amp; scope</h2><p className="mt-1 text-sm text-muted">Read-only preview. Permissions are assigned by the server role policy.</p><dl className="mt-4 grid gap-4 md:grid-cols-2"><div className="border-y border-line py-3"><dt className="text-xs uppercase text-muted">Account type</dt><dd className="mt-1 font-semibold text-ink">{roleDetails[accountType].title}</dd></div><div className="border-y border-line py-3"><dt className="text-xs uppercase text-muted">Jurisdiction</dt><dd className="mt-1 font-semibold text-ink">{scopeText}</dd></div></dl><ul className="mt-4 grid gap-2 sm:grid-cols-2">{accessByRole[accountType].map((item) => <li key={item} className="border-b border-line py-2 text-sm text-ink">{item}</li>)}</ul></section> : null}

      {step === 4 ? <section><h2 className="text-xl font-semibold text-ink">Identity</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><FormField label="Full name" htmlFor="account-name"><TextInput id="account-name" required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></FormField><FormField label="Email address" htmlFor="account-email"><TextInput id="account-email" required type="email" autoComplete="off" maxLength={240} value={email} onChange={(event) => setEmail(event.target.value)} /></FormField><FormField label="Phone (optional)" htmlFor="account-phone"><TextInput id="account-phone" type="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField></div></section> : null}

      {step === 5 ? <section><h2 className="text-xl font-semibold text-ink">Authentication</h2><div className="mt-4 border-y border-line py-4"><p className="font-medium text-ink">Secure invitation</p><p className="mt-2 text-sm text-muted">No password is set by the administrator. A secure one-time activation link will be emailed to {email || "the account holder"}, who creates their own password before the account becomes active.</p></div></section> : null}

      {step === 6 ? <section><h2 className="text-xl font-semibold text-ink">Review account</h2><dl className="mt-4 grid gap-3 md:grid-cols-2">{[["Role", roleDetails[accountType].title], ["Organisation", selectedAgency?.name ?? (accountType === "state_admin" ? "State administration" : "Sub-State administration")], ["Jurisdiction", scopeText], ["Identity", displayName], ["Email", email], ["Invitation", "Secure email activation"]].map(([label, value]) => <div key={label} className="border-b border-line pb-3"><dt className="text-xs uppercase text-muted">{label}</dt><dd className="mt-1 break-words text-ink">{value}</dd></div>)}</dl></section> : null}

      {step === 7 ? <section className="py-5 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-xl text-warning">!</div><h2 className="mt-4 text-2xl font-semibold text-ink">Pending activation</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted">The account was created and its secure invitation was sent. Access remains disabled until the account holder sets a password through the one-time link.</p><p className="mt-3 text-xs text-muted">Account ID: {result?.id}</p><Button className="mt-6" onClick={() => { router.push("/users?kind=admin&status=pending"); router.refresh(); }}>View pending accounts</Button></section> : null}

      {step < 7 ? <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5"><Button variant="secondary" onClick={() => step === 0 ? router.push("/users") : setStep((value) => value - 1)}>{step === 0 ? "Cancel" : "Back"}</Button>{step === 6 ? <Button onClick={createAccount} disabled={submitting}>{submitting ? "Creating account..." : "Create and send invitation"}</Button> : <Button onClick={next}>Continue</Button>}</div> : null}
    </div>
  );
}
