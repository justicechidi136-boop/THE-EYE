import { readFileSync } from "node:fs";
import { join } from "node:path";
import { broadcastApprovalLabel, broadcastAuthor, broadcastPublicReference, compactBroadcastType, matchesBroadcastSearch } from "../broadcast-list-presentation";
import type { BroadcastView } from "../types/admin-views";

const broadcast: BroadcastView = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  type: "StolenVehicle broadcast",
  title: "Stolen Toyota Corolla",
  severity: "P2",
  status: "Published",
  target: "Ikeja, Lagos, Nigeria · 3 km radius",
  author: "John Doe",
  authorLabel: "Citizen",
  requiresApproval: false,
  recipients: 12,
  delivery: "Sent",
  scheduledAt: null,
  schedulingState: "Published",
  dispatchFailureReason: null,
  autoDispatchStatus: "Dispatched",
  adminVerified: true,
  reportCount: 0,
  sightingsCount: 1,
  commentCount: 0,
  country: "Nigeria",
  state: "Lagos",
  suspendedReason: null,
  createdAt: "2026-08-28T10:00:00.000Z",
};

describe("Broadcast list presentation", () => {
  it("uses a stable public reference without exposing the UUID", () => {
    const reference = broadcastPublicReference(broadcast.id);
    expect(reference.startsWith("BC-")).toBe(true);
    expect(reference.includes("bbbbbbbb")).toBe(false);
    expect(broadcastPublicReference(broadcast.id)).toBe(reference);
  });

  it("uses compact type, author, target and approval labels", () => {
    expect(compactBroadcastType(broadcast.type)).toBe("Stolen Vehicle");
    expect(broadcastAuthor(broadcast)).toBe("Citizen · John Doe");
    expect(broadcastApprovalLabel(broadcast)).toBe("Auto-approved");
  });

  it("searches by title, reference, author and location", () => {
    expect(matchesBroadcastSearch(broadcast, "Toyota")).toBe(true);
    expect(matchesBroadcastSearch(broadcast, broadcastPublicReference(broadcast.id))).toBe(true);
    expect(matchesBroadcastSearch(broadcast, "John Doe")).toBe(true);
    expect(matchesBroadcastSearch(broadcast, "Ikeja")).toBe(true);
    expect(matchesBroadcastSearch(broadcast, "Abuja")).toBe(false);
  });

  it("keeps the create form human-readable and moves secondary actions into overflow", () => {
    const root = join(process.cwd());
    const form = readFileSync(join(root, "components", "broadcast-create-form.tsx"), "utf8");
    const listActions = readFileSync(join(root, "components", "broadcast", "broadcast-list-actions.tsx"), "utf8");
    expect(form.includes("Message / content")).toBe(true);
    expect(form.includes("Search a neighborhood, LGA, or address")).toBe(true);
    expect(form.includes("Lat, lng, radius")).toBe(false);
    expect(listActions.includes('aria-label="More actions"')).toBe(true);
  });
});
