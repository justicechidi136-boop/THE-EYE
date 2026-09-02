import { BadRequestException } from "@nestjs/common";

export const ACTIVITY_HISTORY_SECTIONS = [
  "All",
  "Active",
  "Ended",
  "Resolved",
  "Cancelled",
  "Broadcasts",
  "EmergencyReports",
  "SOS",
  "MissingPersons",
  "StolenVehicles",
] as const;

export type ActivityHistorySection = (typeof ACTIVITY_HISTORY_SECTIONS)[number];

export type ActivityHistoryQuery = {
  cursor?: string;
  limit?: string;
  section?: string;
  q?: string;
  incidentId?: string;
  broadcastId?: string;
  vehiclePlate?: string;
  missingPersonName?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  location?: string;
};

export function parseActivityHistoryQuery(raw: ActivityHistoryQuery) {
  const section = raw.section?.trim() || "All";
  if (!ACTIVITY_HISTORY_SECTIONS.includes(section as ActivityHistorySection)) {
    throw new BadRequestException(`Unsupported activity section: ${section}`);
  }

  const from = raw.from?.trim() ? new Date(raw.from.trim()) : undefined;
  const to = raw.to?.trim() ? new Date(raw.to.trim()) : undefined;
  if (from && Number.isNaN(from.getTime())) throw new BadRequestException("from must be a valid ISO timestamp");
  if (to && Number.isNaN(to.getTime())) throw new BadRequestException("to must be a valid ISO timestamp");

  return {
    cursor: raw.cursor?.trim() || undefined,
    limit: raw.limit,
    section: section as ActivityHistorySection,
    q: raw.q?.trim() || undefined,
    incidentId: raw.incidentId?.trim() || undefined,
    broadcastId: raw.broadcastId?.trim() || undefined,
    vehiclePlate: raw.vehiclePlate?.trim() || undefined,
    missingPersonName: raw.missingPersonName?.trim() || undefined,
    category: raw.category?.trim() || undefined,
    status: raw.status?.trim() || undefined,
    from,
    to,
    location: raw.location?.trim() || undefined,
  };
}
