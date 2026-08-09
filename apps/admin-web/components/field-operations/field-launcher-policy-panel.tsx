"use client";

import { useEffect, useState } from "react";

type Policy = {
  deviceMode: string;
  launcherEnabled: boolean;
  kioskEnabled: boolean;
  approvedApps: string[];
  settingsAccessLevel: string;
  maintenanceModeAllowed: boolean;
  emergencyDialerAllowed: boolean;
  browserAllowed: boolean;
  screenshotsAllowed: boolean;
  usbPolicy: string;
  autoLockMinutes: number;
  role: string;
  policyVersion: number;
};

export function FieldLauncherPolicyPanel({
  deviceId,
  canManage,
}: {
  deviceId: string;
  canManage: boolean;
}) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/field-devices/${encodeURIComponent(deviceId)}/policy`);
        const json = (await res.json()) as { data?: Policy; message?: string };
        if (!res.ok) throw new Error(json.message ?? "Unable to load launcher policy");
        if (!cancelled) setPolicy(json.data ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  async function save() {
    if (!policy || !canManage) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/field-devices/${encodeURIComponent(deviceId)}/policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const json = (await res.json()) as { data?: Policy; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Save failed");
      setPolicy(json.data ?? policy);
      setMessage("Launcher policy saved (audited).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (error && !policy) {
    return <p className="text-sm text-red-700">{error}</p>;
  }
  if (!policy) {
    return <p className="text-sm text-slate-600">Loading launcher policy…</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="font-semibold">Device mode</span>
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          disabled={!canManage}
          value={policy.deviceMode}
          onChange={(e) => setPolicy({ ...policy, deviceMode: e.target.value })}
        >
          <option value="standard">standard</option>
          <option value="launcher">launcher</option>
          <option value="managed_kiosk">managed_kiosk</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={!canManage}
          checked={policy.launcherEnabled}
          onChange={(e) => setPolicy({ ...policy, launcherEnabled: e.target.checked })}
        />
        Launcher enabled
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={!canManage}
          checked={policy.kioskEnabled}
          onChange={(e) => setPolicy({ ...policy, kioskEnabled: e.target.checked })}
        />
        Kiosk enabled
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={!canManage}
          checked={policy.maintenanceModeAllowed}
          onChange={(e) => setPolicy({ ...policy, maintenanceModeAllowed: e.target.checked })}
        />
        Maintenance escape allowed
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={!canManage}
          checked={policy.emergencyDialerAllowed}
          onChange={(e) => setPolicy({ ...policy, emergencyDialerAllowed: e.target.checked })}
        />
        Emergency dialer allowed
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={!canManage}
          checked={policy.browserAllowed}
          onChange={(e) => setPolicy({ ...policy, browserAllowed: e.target.checked })}
        />
        Browser allowed
      </label>
      <label className="block">
        <span className="font-semibold">Role</span>
        <input
          className="mt-1 w-full rounded border px-2 py-1"
          disabled={!canManage}
          value={policy.role}
          onChange={(e) => setPolicy({ ...policy, role: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="font-semibold">Approved apps (one package per line)</span>
        <textarea
          className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
          rows={5}
          disabled={!canManage}
          value={policy.approvedApps.join("\n")}
          onChange={(e) =>
            setPolicy({
              ...policy,
              approvedApps: e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className="block">
        <span className="font-semibold">USB policy</span>
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          disabled={!canManage}
          value={policy.usbPolicy}
          onChange={(e) => setPolicy({ ...policy, usbPolicy: e.target.value })}
        >
          <option value="allow">allow</option>
          <option value="charge_only">charge_only</option>
          <option value="deny">deny</option>
        </select>
      </label>
      <p className="text-xs text-slate-500">Policy version {policy.policyVersion}</p>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {canManage ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save launcher policy"}
        </button>
      ) : null}
    </div>
  );
}
