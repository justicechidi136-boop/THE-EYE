import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchFieldPermissionProfiles } from "../../../lib/api/data";
import { canManageFieldDevices } from "../../../lib/field-device-permissions";
import { getAdminSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function FieldPermissionProfilesPage() {
  const session = await getAdminSession();
  const canManage = canManageFieldDevices(session);
  const profiles = await fetchFieldPermissionProfiles();
  const active = profiles.filter((profile) => profile.isActive).length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Field Operations"
        title="Permission profiles"
        action={<StatusBadge tone="success">{active} active · {profiles.length} total</StatusBadge>}
      />
      <Link href="/field-operations/devices" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">
        Back to devices
      </Link>
      <Panel
        title="Field device permission profiles"
        aside={
          canManage ? (
            <Link
              href="/field-operations/permission-profiles/new"
              className="rounded-md bg-eye px-3 py-2 text-sm font-semibold text-white hover:bg-eyeDeep"
            >
              New profile
            </Link>
          ) : undefined
        }
      >
        {!canManage ? <p className="mb-4 text-sm text-muted">Your role can view permission profiles only.</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Operational role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-4 py-3">
                    <Link href={`/field-operations/permission-profiles/${profile.id}`} className="font-semibold text-eye hover:underline">
                      {profile.name}
                    </Link>
                    {profile.isSystem ? <span className="ml-2 text-xs text-muted">System</span> : null}
                  </td>
                  <td className="px-4 py-3"><code className="text-xs">{profile.code}</code></td>
                  <td className="px-4 py-3">{profile.operationalRole ?? "-"}</td>
                  <td className="px-4 py-3">{profile.permissions.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={profile.isActive ? "success" : "danger"}>{profile.isActive ? "Active" : "Disabled"}</StatusBadge>
                  </td>
                </tr>
              ))}
              {!profiles.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No permission profiles yet.{" "}
                    {canManage ? (
                      <Link href="/field-operations/permission-profiles/new" className="font-semibold text-eye hover:underline">
                        Create the first one
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
