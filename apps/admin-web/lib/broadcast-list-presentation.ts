import type { BroadcastView } from "./types/admin-views";

export function broadcastPublicReference(id: string) {
  let hash = 2166136261;
  for (const character of id) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `BC-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

export function compactBroadcastType(type: string) {
  return type.replace(/\s+broadcast$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function broadcastAuthor(broadcast: BroadcastView) {
  if (!broadcast.author || broadcast.author === broadcast.authorLabel) {
    return broadcast.authorLabel === "Admin" ? "Government" : "Anonymous";
  }
  return `${broadcast.authorLabel === "Admin" ? "Government" : "Citizen"} · ${broadcast.author}`;
}

export function matchesBroadcastSearch(broadcast: BroadcastView, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [
    broadcast.title,
    broadcastPublicReference(broadcast.id),
    broadcastAuthor(broadcast),
    broadcast.target,
    compactBroadcastType(broadcast.type),
  ].some((value) => value.toLocaleLowerCase().includes(normalized));
}

export function broadcastApprovalLabel(broadcast: BroadcastView) {
  if (!broadcast.requiresApproval) return "Auto-approved";
  if (broadcast.status === "Pending approval") return "Pending approval";
  return broadcast.adminVerified ? "Approved" : broadcast.status;
}
