import Link from "next/link";
import { redirect } from "next/navigation";
import { AgencyForm } from "../../../components/agencies/agency-form";
import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel } from "../../../components/ui";
import { listAgencies } from "../../../lib/api/agencies";
import { canManageAgencies } from "../../../lib/agency-permissions";
import { getAdminSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function NewAgencyPage() {
  const session = await getAdminSession();
  if (!canManageAgencies(session)) redirect("/agencies");
  const parentOptions = await listAgencies({ isActive: "true" });

  return (
    <AppShell>
      <PageHeader eyebrow="Responder network" title="New agency" />
      <Link href="/agencies" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">
        Back to agency registry
      </Link>
      <Panel title="Agency details">
        <AgencyForm mode="create" parentOptions={parentOptions} />
      </Panel>
    </AppShell>
  );
}
