import { LoadingSpinner } from "../components/form-primitives";
import { PageHeader, Panel } from "../components/ui";

export default function Loading() {
  return (
    <div className="min-h-screen bg-field p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="THE EYE" title="Loading dashboard" />
      <Panel title="Please wait">
        <LoadingSpinner label="Loading page content..." />
      </Panel>
    </div>
  );
}
