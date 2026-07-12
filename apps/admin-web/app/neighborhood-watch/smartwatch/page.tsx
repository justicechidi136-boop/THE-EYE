import { CsocDataTable } from "../../../components/csoc/csoc-data-table";
import { PageHeader, Panel, StatusBadge } from "../../../components/ui";
import { fetchSmartwatchDevices, fetchSosEvents } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function SmartwatchConsolePage() {
  const [devices, sosEvents] = await Promise.all([fetchSmartwatchDevices(), fetchSosEvents()]);
  const online = devices.filter((d) => d.status === "Online" || d.status === "Active");
  const offline = devices.filter((d) => d.status !== "Online" && d.status !== "Active");

  return (
    <>
      <PageHeader
        eyebrow="Smartwatch operations"
        title="Smartwatch Console"
        action={<StatusBadge tone="success">{online.length} online · {offline.length} offline</StatusBadge>}
      />
      <Panel title="SOS events" aside={<StatusBadge tone="danger">{sosEvents.length} events</StatusBadge>}>
        <CsocDataTable
          columns={["User", "Device", "Status", "Priority", "Triggered", "GPS"]}
          rows={sosEvents.map((e) => [
            e.user,
            e.deviceId,
            e.status,
            e.priority,
            e.triggeredAt,
            `${e.gps.lat}, ${e.gps.lng}`,
          ])}
          emptyMessage="No SOS events."
        />
      </Panel>
      <Panel title="Device fleet">
        <CsocDataTable
          columns={["Owner", "Device", "Mode", "Status", "Battery", "Signal", "Firmware", "Last seen"]}
          rows={devices.map((d) => [
            d.owner,
            d.deviceId,
            d.mode,
            <StatusBadge key={`s-${d.id}`} tone={d.status === "Online" ? "success" : "neutral"}>{d.status}</StatusBadge>,
            `${d.battery}%`,
            `${d.signal}%`,
            d.firmware,
            d.lastSeen,
          ])}
          emptyMessage="No smartwatch devices registered."
        />
      </Panel>
    </>
  );
}
