import Link from "next/link";
import { PageHeader, Panel } from "../components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-field p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="404" title="Page not found" />
      <Panel title="This screen does not exist">
        <p className="text-sm text-muted">The requested admin route could not be found. Check the URL or return to the command dashboard.</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye">
          Back to command dashboard
        </Link>
      </Panel>
    </div>
  );
}
