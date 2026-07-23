"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { validateLoginForm } from "../lib/auth-validation";
import { Button, FormField, InlineAlert, TextInput } from "./form-primitives";

function resolvePostLoginPath(rawNext: string | null): string {
  if (!rawNext || rawNext === "/") return "/";
  if (!rawNext.startsWith("/")) return "/";
  if (rawNext.startsWith("//")) return "/";
  if (rawNext.startsWith("/api/")) return "/";
  if (rawNext.includes("logout")) return "/";
  return rawNext;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldErrors = validateLoginForm(email, password);
    setEmailError(fieldErrors.email ?? null);
    setPasswordError(fieldErrors.password ?? null);
    if (fieldErrors.email || fieldErrors.password) {
      setError("Check the highlighted fields before continuing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Login failed");
      }
      const next = resolvePostLoginPath(searchParams.get("next"));
      router.push(next);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid w-full gap-4" onSubmit={handleSubmit} noValidate>
      <div className="text-center">
        <h1 className="text-[36px] font-semibold leading-tight text-command">Welcome Back!</h1>
        <p className="mt-1 text-base text-command/80">Please login to your account</p>
      </div>

      <FormField label="Email" htmlFor={emailId} error={emailError ?? undefined}>
        <TextInput
          id={emailId}
          placeholder="admin@theeye.gov"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailError) setEmailError(null);
          }}
          autoComplete="username"
          required
          className="h-[43px] rounded-lg border-2 border-stroke px-3"
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? `${emailId}-error` : undefined}
        />
      </FormField>

      <div className="grid gap-1">
        <FormField label="Password" htmlFor={passwordId} error={passwordError ?? undefined}>
          <div className="relative">
            <TextInput
              id={passwordId}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError(null);
              }}
              autoComplete="current-password"
              required
              className="h-[43px] rounded-lg border-2 border-stroke px-3 pr-10"
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </FormField>
        <Link href="/login/forgot-password" className="text-right text-base text-eyeDeep hover:underline">
          Forget Password
        </Link>
      </div>

      {error ? (
        <InlineAlert>
          <span id="login-error">{error}</span>
        </InlineAlert>
      ) : null}

      <Button type="submit" disabled={loading} aria-busy={loading} className="h-[46px] w-full rounded-lg">
        {loading ? "Signing in..." : "Continue"}
      </Button>
    </form>
  );
}
