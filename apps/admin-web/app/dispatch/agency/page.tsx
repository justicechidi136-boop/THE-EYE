import { AppShell } from "../../../components/app-shell";
import { PageHeader } from "../../../components/ui";
import { AgencyDispatchActions } from "../../../components/dispatch/agency-dispatch-actions";
import { fetchDispatchIncidents, fetchDispatchResponders } from "../../../lib/api/dispatch";

export const dynamic = "force-dynamic";

export default async function AgencyDispatchPage() {
  const [assigned, responders] = await Promise.all([
    fetchDispatchIncidents({ status: "Assigned" }),
    fetchDispatchResponders(),
  ]);

  return (
    <AppShell>
      <PageHeader eyebrow="Agency dispatch" title="Agency operations" />
      <AgencyDispatchActions incidents={assigned.data ?? []} responders={responders.data ?? []} />
    </AppShell>
  );
}
