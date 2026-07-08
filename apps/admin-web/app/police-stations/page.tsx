import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { policeStations } from "../../lib/mock-data";

export default function PoliceStationsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="PostGIS station locator" title="Police station management" action={<StatusBadge tone="success">{policeStations.length} stations</StatusBadge>} />
      <div className="grid gap-5">
        <Panel title="Add or edit station">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_160px_160px]">
            <label className="grid gap-2 text-sm font-medium">
              Station name
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Ikeja Central Police Station" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Address
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Street, LGA, State" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Latitude
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="6.601800" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Longitude
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="3.351500" />
            </label>
            <button className="self-end rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white">Save station</button>
          </div>
        </Panel>

        <Panel title="Search stations">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Search location" />
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="State" />
            <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="LGA" />
            <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye">
              <option>All agency types</option>
              <option>police</option>
              <option>security</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Station</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Coordinates</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Navigation</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {policeStations.map((station) => (
                  <tr key={station.id}>
                    <td className="px-4 py-3"><p className="font-semibold">{station.name}</p><p className="text-xs text-muted">{station.state} / {station.lga} - {station.distance}</p></td>
                    <td className="px-4 py-3">{station.phone}</td>
                    <td className="px-4 py-3 text-muted">{station.address}</td>
                    <td className="px-4 py-3">{station.latitude}, {station.longitude}</td>
                    <td className="px-4 py-3"><StatusBadge tone="info">{station.agencyType}</StatusBadge></td>
                    <td className="px-4 py-3">
                      <a className="font-semibold text-eye" href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=driving`}>Open route</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
