import type { Incident } from "./types/admin-views";

export type ReportMapPoint = {
  report: Incident;
  x: number;
  y: number;
};

export type ReportMapCluster = {
  id: string;
  reports: Incident[];
  x: number;
  y: number;
};

export function clusterReportMapPoints(points: ReportMapPoint[], radius = 48): ReportMapCluster[] {
  const clusters: ReportMapCluster[] = [];
  for (const point of points) {
    const cluster = clusters.find((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius);
    if (!cluster) {
      clusters.push({ id: point.report.id, reports: [point.report], x: point.x, y: point.y });
      continue;
    }

    const count = cluster.reports.length;
    cluster.x = (cluster.x * count + point.x) / (count + 1);
    cluster.y = (cluster.y * count + point.y) / (count + 1);
    cluster.reports.push(point.report);
    cluster.id = cluster.reports.map((report) => report.id).sort().join(":");
  }
  return clusters;
}
