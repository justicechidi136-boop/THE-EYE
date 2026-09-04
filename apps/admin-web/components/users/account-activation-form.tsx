"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, FormField, InlineAlert, TextInput } from "../form-primitives";

export function AccountActivationForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) return setError("This activation link is incomplete.");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/admin-invitation/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json() as { message?: string; data?: { message?: string } };
      if (!response.ok) throw new Error(payload.message ?? "Unable to activate this account");
      setComplete(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to activate this account");
    } finally {
      setSubmitting(false);
    }
  }

  if (complete) {
    return (
      <div className="grid gap-4">
        <InlineAlert>Your operational account is active. You can now sign in.</InlineAlert>
        <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-md bg-eye px-4 font-semibold text-white hover:bg-eyeDeep">Continue to sign in</Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <FormField label="Create password" htmlFor="activation-password" hint="Use at least 12 characters.">
        <TextInput id="activation-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
      </FormField>
      <FormField label="Confirm password" htmlFor="activation-confirm">
        <TextInput id="activation-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
      </FormField>
      <Button type="submit" disabled={submitting}>{submitting ? "Activating..." : "Activate account"}</Button>
    </form>
  );
}
