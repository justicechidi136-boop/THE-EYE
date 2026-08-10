import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { FieldDevicePreprovisionWizard } from "../../../../components/field-operations/field-device-preprovision-wizard";
import { PageHeader } from "../../../../components/ui";
import { canManageFieldDevices } from "../../../../lib/field-device-permissions";
import { getAdminSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function NewFieldDevicePage() {
  const session = await getAdminSession();
  if (!canManageFieldDevices(session)) redirect("/field-operations/devices");

  return (
    <AppShell>
      <PageHeader eyebrow="Field Operations" title="Pre-provision field device" />
      <Link href="/field-operations/devices" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">
        Back to devices
      </Link>
      <FieldDevicePreprovisionWizard />
    </AppShell>
  );
}
