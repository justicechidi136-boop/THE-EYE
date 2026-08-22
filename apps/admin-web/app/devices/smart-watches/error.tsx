"use client";

import { Button } from "../../../components/form-primitives";

export default function SmartwatchError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="m-4 rounded-lg border border-danger/30 bg-danger/10 p-6 text-danger sm:m-6 lg:m-8" role="alert">
      <h2 className="text-lg font-semibold">Smartwatch Management could not load</h2>
      <p className="mt-2 text-sm">The request failed safely. No device action was performed.</p>
      <div className="mt-4">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
