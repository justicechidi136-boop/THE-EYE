"use client";

import {
  buildCitizenAppReturnDeepLink,
  citizenReturnCopy,
  type CitizenAuthReturnResult,
} from "../lib/citizen-app-return";
import { Button } from "./form-primitives";

type CitizenReturnToAppProps = {
  result: CitizenAuthReturnResult;
  /** When true, render the success headline from the result copy. */
  showTitle?: boolean;
};

/**
 * AUTH-007: opens the citizen mobile app sign-in via custom scheme.
 * Never links to Admin Dashboard /login.
 */
export function CitizenReturnToApp({
  result,
  showTitle = false,
}: CitizenReturnToAppProps) {
  const copy = citizenReturnCopy(result);
  const deepLink = buildCitizenAppReturnDeepLink(result);

  return (
    <div className="grid w-full gap-3 text-center">
      {showTitle ? (
        <h1 className="text-[28px] font-semibold leading-tight text-ink">{copy.title}</h1>
      ) : null}
      <p className="text-sm text-ink/80">{copy.body}</p>
      <Button
        type="button"
        className="h-[46px] w-full rounded-lg"
        onClick={() => {
          // Custom scheme only — no admin fallback.
          window.location.href = deepLink;
        }}
      >
        Return to THE EYE
      </Button>
      <p className="text-xs text-ink/60">
        If the app does not open, return to THE EYE manually and sign in. This page will never send
        you to the Admin Dashboard.
      </p>
      <a
        href={deepLink}
        className="sr-only"
        data-testid="citizen-return-deep-link"
        data-admin-login="false"
      >
        Return to THE EYE
      </a>
    </div>
  );
}
