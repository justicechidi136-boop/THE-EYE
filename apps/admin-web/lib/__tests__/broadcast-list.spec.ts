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

  it("uses the approved lifecycle workspace and hierarchical Admin creation flow", () => {
    const root = join(process.cwd());
    const form = readFileSync(join(root, "components", "broadcast-create-form.tsx"), "utf8");
    const workspace = readFileSync(join(root, "components", "broadcast", "broadcast-workspace.tsx"), "utf8");
    const filters = readFileSync(join(root, "components", "broadcast", "broadcast-filters.tsx"), "utf8");
    const page = readFileSync(join(root, "app", "broadcasts", "page.tsx"), "utf8");
    const list = readFileSync(join(root, "components", "broadcast", "broadcast-list.tsx"), "utf8");
    const listActions = readFileSync(join(root, "components", "broadcast", "broadcast-list-actions.tsx"), "utf8");
    expect(form.includes("Message / content")).toBe(true);
    expect(form.includes("Safety Alert")).toBe(true);
    expect(form.includes("Public Advisory")).toBe(true);
    expect(form.includes("Emergency Warning")).toBe(true);
    expect(form.includes("Missing person")).toBe(false);
    expect(form.includes("City / LGA")).toBe(true);
    expect(form.includes("Location level")).toBe(true);
    expect(form.includes("changeLocationLevel")).toBe(true);
    expect(form.includes("Search community")).toBe(true);
    expect(form.includes("EntireArea")).toBe(true);
    expect(form.includes("jurisdictionId")).toBe(true);
    expect(form.includes("communityId")).toBe(true);
    expect(form.includes("Lat, lng, radius")).toBe(false);
    expect(workspace.includes("Published")).toBe(true);
    expect(workspace.includes("Active")).toBe(true);
    expect(workspace.includes("Expired")).toBe(true);
    expect(workspace.includes("Cancelled")).toBe(true);
    expect(filters.includes("Last 7 days")).toBe(true);
    expect(filters.includes("Custom range")).toBe(true);
    for (const name of ["search", "category", "status", "author", "country", "state", "lga", "communityId", "time"]) {
      expect(filters.includes(`name="${name}"`)).toBe(true);
    }
    expect(filters.includes('<form method="get"')).toBe(true);
    expect(filters.includes('href="/broadcasts"')).toBe(true);
    expect(page.includes('page: readParam(params.page) ?? "1"')).toBe(true);
    expect(list.includes('>Delivery<')).toBe(false);
    expect(list.includes("visiblePages")).toBe(true);
    expect(listActions.includes('aria-label="More actions"')).toBe(true);
  });
});
