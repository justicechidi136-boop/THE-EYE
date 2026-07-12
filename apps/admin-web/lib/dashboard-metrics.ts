import type { DashboardChartPoint, Incident, LiveVideoSessionView } from "./types/admin-views";
import { PLACEHOLDER_DEPENDENCIES } from "./placeholder-dependencies";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildDashboardChart(
  incidents: Incident[],
  userCount: number,
  sessions: LiveVideoSessionView[],
): { points: DashboardChartPoint[]; footnote: string } {
  const now = new Date();
  const buckets = new Map<string, { reports: number; users: number; videos: number; label: string }>();

  for (let offset = 8; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKey(date);
    buckets.set(key, { reports: 0, users: 0, videos: 0, label: MONTH_LABELS[date.getMonth()] });
  }

  for (const incident of incidents) {
    const date = parseDate(incident.createdAt);
    if (!date) continue;
    const bucket = buckets.get(monthKey(date));
    if (bucket) bucket.reports += 1;
  }

  for (const session of sessions) {
    const date = parseDate(session.startedAt);
    if (!date) continue;
    const bucket = buckets.get(monthKey(date));
    if (bucket) bucket.videos += 1;
  }

  const currentBucket = buckets.get(monthKey(now));
  if (currentBucket) currentBucket.users = userCount;

  const values = [...buckets.values()];
  const maxValue = Math.max(1, ...values.flatMap((entry) => [entry.reports, entry.users, entry.videos]));

  const points = values.map((entry) => ({
    month: entry.label,
    reports: Math.round((entry.reports / maxValue) * 100),
    users: Math.round((entry.users / maxValue) * 100),
    videos: Math.round((entry.videos / maxValue) * 100),
  }));

  return {
    points,
    footnote: `Live incident and session counts by month. ${PLACEHOLDER_DEPENDENCIES.dashboardUserTrends.note}`,
  };
}

export function deriveAgencySummaries(incidents: Incident[]) {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    const agency = incident.assignedAgency.trim();
    if (!agency || agency === "Unassigned") continue;
    counts.set(agency, (counts.get(agency) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, activeIncidents]) => ({
      name,
      type: "Responder",
      jurisdiction: "Derived from incidents",
      activeIncidents,
    }))
    .sort((left, right) => right.activeIncidents - left.activeIncidents);
}
