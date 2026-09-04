import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchFieldDevices } from "../../../lib/api/data";
import { canManageFieldDevices } from "../../../lib/field-device-permissions";
import { getAdminSession } from "../../../lib/session";
import { formatJurisdiction } from "../../../lib/admin-presentation";

export const dynamic = "force-dynamic";

function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "Active") return "success";
  if (status === "PendingApproval") return "warning";
  if (status === "Lost" || status === "Revoked") return "danger";
  return "info";
}

export default async function FieldDevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; agencyId?: string }>;
}) {
  const params = await searchParams;
  const session = await getAdminSession();
  const canManage = canManageFieldDevices(session);
  const devices = await fetchFieldDevices({ status: params.status, agencyId: params.agencyId });
  const pending = devices.filter((device) => device.registrationStatus === "PendingApproval").length;
  const active = devices.filter((device) => device.registrationStatus === "Active").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Field Operations"
        title="Field tablets"
        action={<StatusBadge tone="success">{active} active · {pending} pending</StatusBadge>}
      />
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/field-operations/devices" className="rounded border border-line px-3 py-1 hover:border-eye">All</Link>
        <Link href="/field-operations/devices?status=PendingApproval" className="rounded border border-line px-3 py-1 hover:border-eye">Pending approval</Link>
        <Link href="/field-operations/devices?status=Active" className="rounded border border-line px-3 py-1 hover:border-eye">Active</Link>
        <Link href="/field-operations/devices?status=Suspended" className="rounded border border-line px-3 py-1 hover:border-eye">Suspended</Link>
        <Link href="/field-operations/devices?status=Lost" className="rounded border border-line px-3 py-1 hover:border-eye">Lost</Link>
        <Link href="/field-operations/devices?status=Revoked" className="rounded border border-line px-3 py-1 hover:border-eye">Revoked</Link>
      </div>
      <Panel title="Registered field tablets">
        {!canManage ? (
          <p className="text-sm text-muted">Your role can view limited device inventory only.</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Officer</th>
                <th className="px-4 py-3">Jurisdiction</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3">Battery</th>
                <th className="px-4 py-3">Network</th>
                <th className="px-4 py-3">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {devices.map((device) => (
                <tr key={device.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      <Link href={`/field-operations/devices/${device.id}`} className="text-eye hover:underline">
                        {device.deviceName}
                      </Link>
                    </p>
                    <p className="text-xs text-muted">{device.publicDeviceId}</p>
                  </td>
                  <td className="px-4 py-3">{device.assignedUserId ?? "Unassigned"}</td>
                  <td className="px-4 py-3">
                    {formatJurisdiction([device.countryCode, device.stateCode, device.lgaCode], "-")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={statusTone(device.registrationStatus)}>{device.registrationStatus}</StatusBadge>
                  </td>
                  <td className="px-4 py-3">{device.manufacturer} · {device.model}</td>
                  <td className="px-4 py-3">{device.appVersion}</td>
                  <td className="px-4 py-3">{device.lastSeen}</td>
                  <td className="px-4 py-3">{device.batteryLevel != null ? `${device.batteryLevel}%` : "-"}</td>
                  <td className="px-4 py-3">{device.networkType}</td>
                  <td className="px-4 py-3">
                    {device.isRootRiskDetected ? <StatusBadge tone="warning">Root risk</StatusBadge> : "-"}
                    {device.requiresRePair ? <StatusBadge tone="warning">Re-pair</StatusBadge> : null}
                  </td>
                </tr>
              ))}
              {!devices.length ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted">No field tablets registered in your scope.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
