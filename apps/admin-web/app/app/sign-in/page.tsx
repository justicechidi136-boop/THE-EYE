"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "../../../components/auth-layout";
import { CitizenReturnToApp } from "../../../components/citizen-return-to-app";
import {
  buildCitizenAppReturnDeepLink,
  type CitizenAuthReturnResult,
} from "../../../lib/citizen-app-return";
import { InlineAlert } from "../../../components/form-primitives";

const ALLOWED_RESULTS = new Set<CitizenAuthReturnResult>([
  "PASSWORD_RESET_SUCCESS",
  "ACCOUNT_RECOVERY_SUCCESS",
  "PASSWORD_RESET_REQUIRED",
  "ACCOUNT_RECOVERY_CONTINUE",
]);

function SignInReturnPanel() {
  const searchParams = useSearchParams();
  const result = useMemo(() => {
    const raw = (searchParams.get("result") ?? "PASSWORD_RESET_SUCCESS").trim();
    if (ALLOWED_RESULTS.has(raw as CitizenAuthReturnResult)) {
      return raw as CitizenAuthReturnResult;
    }
    return "PASSWORD_RESET_SUCCESS" as CitizenAuthReturnResult;
  }, [searchParams]);

  useEffect(() => {
    const deepLink = buildCitizenAppReturnDeepLink(result);
    // Attempt to open the citizen app; ignore failures (show fallback UI).
    const timer = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 250);
    return () => window.clearTimeout(timer);
  }, [result]);

  return (
    <div className="grid w-full gap-4 text-center">
      <InlineAlert tone="success">
        <span>Opening THE EYE…</span>
      </InlineAlert>
      <CitizenReturnToApp result={result} showTitle />
    </div>
  );
}

/** Public HTTPS soft-landing: tries citizen deep link; never Admin /login. */
export default function CitizenAppSignInPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={
          <p className="text-center text-sm text-muted" role="status">
            Preparing return to THE EYE…
          </p>
        }
      >
        <SignInReturnPanel />
      </Suspense>
    </AuthLayout>
  );
}
