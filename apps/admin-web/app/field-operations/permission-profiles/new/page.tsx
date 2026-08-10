import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { FieldPermissionProfileForm } from "../../../../components/field-operations/field-permission-profile-form";
import { PageHeader, Panel } from "../../../../components/ui";
import { canManageFieldDevices } from "../../../../lib/field-device-permissions";
import { getAdminSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function NewFieldPermissionProfilePage() {
  const session = await getAdminSession();
  if (!canManageFieldDevices(session)) redirect("/field-operations/permission-profiles");

  return (
    <AppShell>
      <PageHeader eyebrow="Field Operations" title="New permission profile" />
      <Link href="/field-operations/permission-profiles" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">
        Back to permission profiles
      </Link>
      <Panel title="Profile details">
        <FieldPermissionProfileForm mode="create" />
      </Panel>
    </AppShell>
  );
}
