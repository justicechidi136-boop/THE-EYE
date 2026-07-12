"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AuthLayout } from "../../../components/auth-layout";
import { Button, FormField, InlineAlert, TextInput } from "../../../components/form-primitives";
import { validateResetToken } from "../../../lib/auth-validation";

export default function VerifyLoginPage() {
  const router = useRouter();
  const tokenId = useId();
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTokenError = validateResetToken(token);
    setTokenError(nextTokenError);
    if (nextTokenError) {
      setError(nextTokenError);
      return;
    }
    setError(null);
    router.push("/");
  }

  return (
    <AuthLayout>
      <form className="grid w-full gap-4" onSubmit={handleSubmit} noValidate>
        <div className="text-center">
          <h1 className="text-[36px] font-semibold leading-tight text-command">Check your mail</h1>
          <p className="mt-1 text-base text-command/80">A token has been sent to your mail</p>
        </div>
        <FormField label="Enter token" htmlFor={tokenId} error={tokenError ?? undefined}>
          <TextInput
            id={tokenId}
            placeholder="Enter verification token"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              if (tokenError) setTokenError(null);
            }}
            autoComplete="one-time-code"
            required
            className="h-[43px] rounded-lg border-2 border-stroke px-3"
            aria-invalid={Boolean(tokenError)}
            aria-describedby={tokenError ? `${tokenId}-error` : undefined}
          />
        </FormField>
        {error ? <InlineAlert><span>{error}</span></InlineAlert> : null}
        <Button type="submit" className="h-[46px] w-full rounded-lg">Verify</Button>
        <Link href="/login" className="text-center text-sm text-eyeDeep hover:underline">Back to sign in</Link>
      </form>
    </AuthLayout>
  );
}
