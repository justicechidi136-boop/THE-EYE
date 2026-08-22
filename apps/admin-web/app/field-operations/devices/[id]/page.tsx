import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { FieldDeviceActions } from "../../../../components/field-operations/field-device-actions";
import { FieldDevicePairingPanel } from "../../../../components/field-operations/field-device-pairing-panel";
import { FieldDeviceProvisioningPanel } from "../../../../components/field-operations/field-device-provisioning-panel";
import { FieldLauncherPolicyPanel } from "../../../../components/field-operations/field-launcher-policy-panel";
import { PageHeader, Panel, StatusBadge } from "../../../../components/ui";
import { fetchFieldDevice } from "../../../../lib/api/data";
import { canManageFieldDevices } from "../../../../lib/field-device-permissions";
import { getAdminSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function FieldDeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  const canManage = canManageFieldDevices(session);
  const device = await fetchFieldDevice(id);

  if (!device) {
    return (
      <AppShell>
        <PageHeader eyebrow="Field Operations" title="Field tablet not found" action={<StatusBadge tone="warning">Missing</StatusBadge>} />
        <Link href="/field-operations/devices" className="text-sm font-semibold text-eye hover:underline">Back to devices</Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Field Operations"
        title={device.deviceName}
        action={<StatusBadge tone={device.registrationStatus === "Active" ? "success" : "warning"}>{device.registrationStatus}</StatusBadge>}
      />
      <Link href="/field-operations/devices" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">Back to devices</Link>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="Identity and telemetry">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p><span className="font-semibold">Public ID:</span> {device.publicDeviceId}</p>
            <p><span className="font-semibold">Assigned officer:</span> {device.assignedUserId ?? "Unassigned"}</p>
            <p><span className="font-semibold">Agency:</span> {device.agencyId ?? "-"}</p>
            <p><span className="font-semibold">Unit:</span> {device.assignedUnitId ?? "-"}</p>
            <p><span className="font-semibold">Jurisdiction:</span> {[device.countryCode, device.stateCode, device.lgaCode].filter(Boolean).join(" / ") || "-"}</p>
            <p><span className="font-semibold">Model:</span> {device.manufacturer} · {device.model}</p>
            <p><span className="font-semibold">Android:</span> {device.androidVersion}</p>
            <p><span className="font-semibold">App version:</span> {device.appVersion}</p>
            <p><span className="font-semibold">Last seen:</span> {device.lastSeen}</p>
            <p><span className="font-semibold">Battery:</span> {device.batteryLevel != null ? `${device.batteryLevel}%` : "-"}</p>
            <p><span className="font-semibold">Network:</span> {device.networkType}</p>
            <p><span className="font-semibold">Registered:</span> {device.registeredAt}</p>
            <p><span className="font-semibold">Approved:</span> {device.approvedAt ?? "Not approved"}</p>
            <p><span className="font-semibold">Lost:</span> {device.isLost ? "Yes" : "No"}</p>
            <p><span className="font-semibold">Revoked:</span> {device.isRevoked ? "Yes" : "No"}</p>
            <p><span className="font-semibold">Re-pair required:</span> {device.requiresRePair ? "Yes" : "No"}</p>
            <p><span className="font-semibold">Root risk:</span> {device.isRootRiskDetected ? "Detected" : "None reported"}</p>
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="Supervisor actions">
            <FieldDeviceActions device={device} canManage={canManage} />
          </Panel>
          <Panel title="Supervisor token">
            <FieldDevicePairingPanel
              device={device}
              canManage={canManage}
              supervisorLabel={session?.email ?? session?.role ?? "Current administrator"}
            />
          </Panel>
          <Panel title="Launcher policy">
            <FieldLauncherPolicyPanel deviceId={device.id} canManage={canManage} />
          </Panel>
        </div>
      </div>
      <div className="mt-5">
        <Panel title="Provisioning & permission profile">
          <FieldDeviceProvisioningPanel device={device} canManage={canManage} />
        </Panel>
      </div>
    </AppShell>
  );
}
