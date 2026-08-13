"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useId, useMemo, useState } from "react";
import { AuthLayout } from "../../components/auth-layout";
import { CitizenReturnToApp } from "../../components/citizen-return-to-app";
import { Button, FormField, InlineAlert, TextInput } from "../../components/form-primitives";
import { validatePassword } from "../../lib/auth-validation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const passwordId = useId();
  const confirmId = useId();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!token || token.length < 10) {
      setError("This reset link is invalid or incomplete. Request a new password reset.");
      return;
    }

    const nextPasswordError = validatePassword(password);
    const nextConfirmError = password !== confirm ? "Passwords do not match." : null;
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) {
      setError("Check the highlighted fields before continuing.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "We couldn’t process your request right now.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("We couldn’t send recovery instructions right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="grid w-full gap-4 text-center">
        <h1 className="text-[32px] font-semibold leading-tight text-ink">Reset password</h1>
        <InlineAlert>
          <span>
            This reset link is invalid or incomplete. Request a new password reset from THE EYE.
          </span>
        </InlineAlert>
        <CitizenReturnToApp result="PASSWORD_RESET_REQUIRED" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="grid w-full gap-4 text-center">
        <CitizenReturnToApp result="PASSWORD_RESET_SUCCESS" showTitle />
        <InlineAlert tone="success">
          <span>Your password has been reset successfully.</span>
        </InlineAlert>
      </div>
    );
  }

  return (
    <form className="grid w-full gap-4" onSubmit={handleSubmit} noValidate>
      <div className="text-center">
        <h1 className="text-[32px] font-semibold leading-tight text-ink">Reset password</h1>
        <p className="mt-1 text-base text-ink/80">Choose a new password for your THE EYE account.</p>
      </div>
      <FormField label="New password" htmlFor={passwordId} error={passwordError ?? undefined}>
        <TextInput
          id={passwordId}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(null);
          }}
          className="h-[43px] rounded-lg border-2 border-stroke px-3"
          required
          aria-invalid={Boolean(passwordError)}
        />
      </FormField>
      <FormField label="Confirm password" htmlFor={confirmId} error={confirmError ?? undefined}>
        <TextInput
          id={confirmId}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            if (confirmError) setConfirmError(null);
          }}
          className="h-[43px] rounded-lg border-2 border-stroke px-3"
          required
          aria-invalid={Boolean(confirmError)}
        />
      </FormField>
      {error ? (
        <InlineAlert>
          <span>{error}</span>
        </InlineAlert>
      ) : null}
      <Button type="submit" className="h-[46px] w-full rounded-lg" disabled={submitting}>
        {submitting ? "Updating…" : "Update password"}
      </Button>
      <p className="text-center text-sm text-ink/80">
        After updating, you will return to THE EYE — not the Admin Dashboard.
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={
          <p className="text-center text-sm text-muted" role="status">
            Loading reset form…
          </p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
