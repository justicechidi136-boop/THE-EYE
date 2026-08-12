"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AuthLayout } from "../../components/auth-layout";
import { InlineAlert } from "../../components/form-primitives";

type VerifyState = "loading" | "valid" | "invalid" | "missing";

function AccountRecoveryPanel() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [state, setState] = useState<VerifyState>(token ? "loading" : "missing");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("missing");
      return;
    }
    if (token.length < 10) {
      setState("invalid");
      setMessage("This recovery link is invalid or incomplete.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/account-recovery/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        if (cancelled) return;
        if (!response.ok) {
          setState("invalid");
          setMessage(payload.message ?? "This recovery link is invalid, expired, or already used.");
          return;
        }
        setState("valid");
        setMessage(null);
      } catch {
        if (cancelled) return;
        setState("invalid");
        setMessage("We couldn’t process your request right now.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <div className="grid w-full gap-4 text-center">
        <h1 className="text-[32px] font-semibold leading-tight text-ink">Recover account</h1>
        <p className="text-sm text-muted" role="status">
          Checking your recovery link…
        </p>
      </div>
    );
  }

  if (state === "missing" || state === "invalid") {
    return (
      <div className="grid w-full gap-4 text-center">
        <h1 className="text-[32px] font-semibold leading-tight text-ink">Recover account</h1>
        <InlineAlert>
          <span>
            {message ??
              "This recovery link is missing a token. Request a new recovery email from the THE EYE app."}
          </span>
        </InlineAlert>
        <p className="text-sm text-ink/80">
          Return to the THE EYE app and continue account recovery there.
        </p>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-4 text-center">
      <h1 className="text-[32px] font-semibold leading-tight text-ink">Recovery link verified</h1>
      <InlineAlert tone="success">
        <span>
          Your account recovery is confirmed. Return to the THE EYE app and continue account
          recovery to finish restoring access.
        </span>
      </InlineAlert>
      <p className="text-sm text-ink/80">
        Keep this page open only if you still need the link. Do not share recovery links with anyone.
      </p>
      <p className="text-sm text-ink/80">
        Return to the THE EYE app and continue account recovery.
      </p>
    </div>
  );
}

export default function AccountRecoveryPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={
          <p className="text-center text-sm text-muted" role="status">
            Loading recovery page…
          </p>
        }
      >
        <AccountRecoveryPanel />
      </Suspense>
    </AuthLayout>
  );
}
