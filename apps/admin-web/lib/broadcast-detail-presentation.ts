import type { BroadcastDetailView } from "./types/admin-views";

const primaryRolePattern = /personphoto|primary|face|portrait/i;
const vehicleIdentityRolePattern = /vehiclephoto|front|rear|side|other/i;

export function broadcastTypeLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

export function formatBroadcastDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function splitBroadcastMedia(broadcast: BroadcastDetailView) {
  const shouldSeparateIdentity = broadcast.type === "MissingPerson" || broadcast.type === "StolenVehicle";
  if (!shouldSeparateIdentity) return { primary: [], identity: [], evidence: broadcast.attachments };
  const images = broadcast.attachments.filter((item) => item.mediaType.toLowerCase() === "image");
  const primary = broadcast.type === "MissingPerson"
    ? images.filter((item) => primaryRolePattern.test(item.label)).slice(0, 1)
    : [];
  if (broadcast.type === "MissingPerson" && !primary.length && images.length) primary.push(images[0]);
  const primaryIds = new Set(primary.map((item) => item.id ?? item.label));
  const identity = broadcast.type === "StolenVehicle"
    ? images.filter((item) => vehicleIdentityRolePattern.test(item.label))
    : [];
  const identityIds = new Set([...primaryIds, ...identity.map((item) => item.id ?? item.label)]);
  return {
    primary,
    identity,
    evidence: broadcast.attachments.filter((item) => !identityIds.has(item.id ?? item.label)),
  };
}

export function deliverySummary(broadcast: BroadcastDetailView) {
  if (!broadcast.deliveryBreakdown.length) return "No recipient delivery records yet";
  return broadcast.deliveryBreakdown.map((item) => `${item.count} ${item.status.toLowerCase()}`).join(" · ");
}

export function hasBroadcastCoordinates(broadcast: BroadcastDetailView) {
  return broadcast.targetLatitude != null
    && broadcast.targetLongitude != null
    && Number.isFinite(broadcast.targetLatitude)
    && Number.isFinite(broadcast.targetLongitude)
    && broadcast.targetLatitude >= -90
    && broadcast.targetLatitude <= 90
    && broadcast.targetLongitude >= -180
    && broadcast.targetLongitude <= 180
    && !(broadcast.targetLatitude === 0 && broadcast.targetLongitude === 0);
}
