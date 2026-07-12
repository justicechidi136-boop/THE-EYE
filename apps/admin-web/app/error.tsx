"use client";

import { Button } from "../components/form-primitives";
import { PageHeader, Panel } from "../components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-field p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="Something went wrong" title="Unable to load this page" />
      <Panel title="Error details">
        <p className="text-sm text-muted" role="alert">
          {error.message || "An unexpected error occurred while loading this screen."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.location.assign("/")}>
            Go to command dashboard
          </Button>
        </div>
      </Panel>
    </div>
  );
}
