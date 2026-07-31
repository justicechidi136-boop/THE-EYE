import { AppShell } from "../../../components/app-shell";
import { SafetyAlertsSubnav } from "../../../components/safety-alerts/safety-alerts-subnav";
import { StagingWatchTestAlertForm } from "../../../components/safety-alerts/staging-watch-test-alert-form";
import { PageHeader, Panel } from "../../../components/ui";
import { fetchWatchFeatureFlags, fetchWatchNotificationAnalytics } from "../../../lib/api/data";

export const dynamic = "force-dynamic";

export default async function WatchAnalyticsPage() {
  let analytics: Awaited<ReturnType<typeof fetchWatchNotificationAnalytics>> | null = null;
  let flags: Record<string, boolean> | null = null;
  let error: string | null = null;

  try {
    [analytics, flags] = await Promise.all([
      fetchWatchNotificationAnalytics(),
      fetchWatchFeatureFlags(),
    ]);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to load watch analytics";
  }

  const totals = analytics?.totals ?? {};
  const events = analytics?.events ?? [];
  const flagEntries = flags?.flags ?? {};
  const flagValidation = flags?.validation;
  const testAlertEnabled = flagEntries.WATCH_ADMIN_TEST_ALERT === true;

  return (
    <AppShell>
      <PageHeader eyebrow="Safety Alerts" title="Watch notification analytics" />
      <p className="mb-4 text-sm text-muted">
        Delivery, speech, dedupe suppression, and acknowledgement telemetry for smartwatch danger alerts.
      </p>
      <SafetyAlertsSubnav />

      {error ? (
        <Panel title="Error">
          <p className="text-sm text-danger">{error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Delivery totals">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(totals).map(([key, value]) => (
              <div key={key}>
                <dt className="text-muted">{key}</dt>
                <dd className="text-lg font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="lg:col-span-2">
          <Panel title="Feature flags">
          <div className="flex flex-wrap gap-2">
            {Object.entries(flagEntries).map(([flag, enabled]) => (
                  <span
                    key={flag}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      enabled ? "bg-emerald-100 text-emerald-800" : "bg-surfaceMuted text-muted"
                    }`}
                  >
                    {flag}: {enabled ? "ON" : "OFF"}
                  </span>
                ))}
          </div>
          {flagValidation && !flagValidation.valid ? (
            <div className="mt-4 space-y-2">
              {flagValidation.issues.map((issue) => (
                <p key={issue.code} className="text-xs text-amber-700">
                  {issue.severity.toUpperCase()}: {issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </Panel>
        </div>
      </div>

      <Panel title="Recent telemetry events">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surfaceMuted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Battery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((event, index) => (
                <tr key={`${event.safetyAlertId ?? "event"}-${index}`}>
                  <td className="px-4 py-3">{String(event.event ?? "—")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(event.safetyAlertId ?? "—")}</td>
                  <td className="px-4 py-3">{String(event.channel ?? "—")}</td>
                  <td className="px-4 py-3">{String(event.language ?? "—")}</td>
                  <td className="px-4 py-3">{String(event.model ?? event.deviceId ?? "—")}</td>
                  <td className="px-4 py-3">{String(event.batteryLevel ?? "—")}</td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>
                    No watch telemetry recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Staging test alert">
        <p className="mb-4 text-sm text-muted">
          Restricted to super/country admins. Disabled in production unless explicitly authorized via feature flag.
        </p>
        <StagingWatchTestAlertForm disabled={!testAlertEnabled} />
      </Panel>
    </AppShell>
  );
}
