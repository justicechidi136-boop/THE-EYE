import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { FieldPermissionProfileDisableButton } from "../../../../components/field-operations/field-permission-profile-disable-button";
import { FieldPermissionProfileForm } from "../../../../components/field-operations/field-permission-profile-form";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchFieldPermissionProfile } from "../../../../lib/api/data";
import { canManageFieldDevices } from "../../../../lib/field-device-permissions";
import { getAdminSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function FieldPermissionProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  const canManage = canManageFieldDevices(session);
  const profile = await fetchFieldPermissionProfile(id);

  if (!profile) {
    return (
      <AppShell>
        <PageHeader eyebrow="Field Operations" title="Permission profile not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
        <Link href="/field-operations/permission-profiles" className="text-sm font-semibold text-eye hover:underline">
          Back to permission profiles
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Field Operations"
        title={profile.name}
        action={<StatusBadge tone={profile.isActive ? "success" : "danger"}>{profile.isActive ? "Active" : "Disabled"}</StatusBadge>}
      />
      <Link href="/field-operations/permission-profiles" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">
        Back to permission profiles
      </Link>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Panel title="Profile details">
          <FieldPermissionProfileForm mode="edit" profile={profile} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Metadata">
            <div className="grid gap-2 text-sm">
              <p><span className="font-semibold">Code:</span> <code className="text-xs">{profile.code}</code></p>
              <p><span className="font-semibold">System profile:</span> {profile.isSystem ? "Yes" : "No"}</p>
              <p><span className="font-semibold">Created:</span> {profile.createdAt}</p>
              <p><span className="font-semibold">Updated:</span> {profile.updatedAt}</p>
              {!profile.isActive ? (
                <>
                  <p><span className="font-semibold">Disabled at:</span> {profile.disabledAt ?? "-"}</p>
                  <p><span className="font-semibold">Disabled reason:</span> {profile.disabledReason ?? "-"}</p>
                </>
              ) : null}
            </div>
          </Panel>
          {canManage && !profile.isSystem && profile.isActive ? (
            <Panel title="Danger zone">
              <FieldPermissionProfileDisableButton profileId={profile.id} />
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
