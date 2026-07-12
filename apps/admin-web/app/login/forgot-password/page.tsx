"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { AuthLayout } from "../../../components/auth-layout";
import { Button, FormField, InlineAlert, TextInput } from "../../../components/form-primitives";
import { validateLoginEmail, validatePassword, validateResetToken } from "../../../lib/auth-validation";

type Step = "email" | "token" | "reset";

export default function ForgotPasswordPage() {
  const emailId = useId();
  const tokenId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmailError = validateLoginEmail(email);
    setEmailError(nextEmailError);
    if (nextEmailError) {
      setError("Enter the email address linked to your account.");
      return;
    }
    setError(null);
    setMessage("A token has been sent to your email.");
    setStep("token");
  }

  function handleTokenSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTokenError = validateResetToken(token);
    setTokenError(nextTokenError);
    if (nextTokenError) {
      setError(nextTokenError);
      return;
    }
    setError(null);
    setStep("reset");
  }

  function handleResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPasswordError = validatePassword(password);
    const nextConfirmError = password !== confirm ? "Passwords do not match." : null;
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) {
      setError("Check the highlighted fields before continuing.");
      return;
    }
    setError(null);
    setMessage("Password updated. You can sign in with your new credentials.");
  }

  return (
    <AuthLayout>
      {step === "email" ? (
        <form className="grid w-full gap-4" onSubmit={handleEmailSubmit} noValidate>
          <div className="text-center">
            <h1 className="text-[36px] font-semibold leading-tight text-command">Enter Email</h1>
            <p className="mt-1 text-base text-command/80">Enter your admin email</p>
          </div>
          <FormField label="Email" htmlFor={emailId} error={emailError ?? undefined}>
            <TextInput
              id={emailId}
              type="email"
              placeholder="admin@theeye.gov"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(null);
              }}
              className="h-[43px] rounded-lg border-2 border-stroke px-3"
              required
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? `${emailId}-error` : undefined}
            />
          </FormField>
          {error ? <InlineAlert><span>{error}</span></InlineAlert> : null}
          <Button type="submit" className="h-[46px] w-full rounded-lg">Continue</Button>
          <Link href="/login" className="text-center text-sm text-eyeDeep hover:underline">Back to sign in</Link>
        </form>
      ) : null}

      {step === "token" ? (
        <form className="grid w-full gap-4" onSubmit={handleTokenSubmit} noValidate>
          <div className="text-center">
            <h1 className="text-[36px] font-semibold leading-tight text-command">Check your mail</h1>
            <p className="mt-1 text-base text-command/80">A token has been sent to your email</p>
          </div>
          {message ? <p className="rounded-md bg-field px-3 py-2 text-sm text-muted">{message}</p> : null}
          <FormField label="Enter token" htmlFor={tokenId} error={tokenError ?? undefined}>
            <TextInput
              id={tokenId}
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                if (tokenError) setTokenError(null);
              }}
              className="h-[43px] rounded-lg border-2 border-stroke px-3"
              required
              aria-invalid={Boolean(tokenError)}
              aria-describedby={tokenError ? `${tokenId}-error` : undefined}
            />
          </FormField>
          {error ? <InlineAlert><span>{error}</span></InlineAlert> : null}
          <Button type="submit" className="h-[46px] w-full rounded-lg">Verify</Button>
        </form>
      ) : null}

      {step === "reset" ? (
        <form className="grid w-full gap-4" onSubmit={handleResetSubmit} noValidate>
          <div className="text-center">
            <h1 className="text-[36px] font-semibold leading-tight text-command">Reset Password</h1>
          </div>
          <FormField label="New Password" htmlFor={passwordId} error={passwordError ?? undefined}>
            <TextInput
              id={passwordId}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className="h-[43px] rounded-lg border-2 border-stroke px-3"
              required
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            />
          </FormField>
          <FormField label="Confirm Password" htmlFor={confirmId} error={confirmError ?? undefined}>
            <TextInput
              id={confirmId}
              type="password"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                if (confirmError) setConfirmError(null);
              }}
              className="h-[43px] rounded-lg border-2 border-stroke px-3"
              required
              aria-invalid={Boolean(confirmError)}
              aria-describedby={confirmError ? `${confirmId}-error` : undefined}
            />
          </FormField>
          {error ? <InlineAlert><span>{error}</span></InlineAlert> : null}
          {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
          <Button type="submit" className="h-[46px] w-full rounded-lg">Continue</Button>
          <Link href="/login" className="text-center text-sm text-eyeDeep hover:underline">Back to sign in</Link>
        </form>
      ) : null}
    </AuthLayout>
  );
}
