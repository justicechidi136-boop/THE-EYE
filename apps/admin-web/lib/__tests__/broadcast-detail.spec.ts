import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deliverySummary, formatBroadcastDate, hasBroadcastCoordinates, splitBroadcastMedia } from "../broadcast-detail-presentation";
import { toBroadcastDetailView } from "../mappers";

const broadcast = {
  type: "StolenVehicle",
  attachments: [
    { id: "front", mediaType: "image", label: "Front", contentType: "image/jpeg" },
    { id: "video", mediaType: "video", label: "Additional evidence", contentType: "video/mp4" },
  ],
  deliveryBreakdown: [{ status: "Sent", count: 12 }, { status: "Read", count: 4 }],
  targetLatitude: 6.5244,
  targetLongitude: 3.3792,
} as any;

describe("Broadcast Details presentation", () => {
  it("separates identity photos from additional evidence", () => {
    const media = splitBroadcastMedia(broadcast);
    expect(media.identity.map((item) => item.id)).toEqual(["front"]);
    expect(media.evidence.map((item) => item.id)).toEqual(["video"]);
  });

  it("separates a missing-person primary face photo from evidence", () => {
    const media = splitBroadcastMedia({
      ...broadcast,
      type: "MissingPerson",
      attachments: [
        { id: "face", mediaType: "image", label: "PersonPhoto" },
        { id: "voice", mediaType: "audio", label: "IncidentEvidence" },
      ],
    });
    expect(media.primary.map((item) => item.id)).toEqual(["face"]);
    expect(media.evidence.map((item) => item.id)).toEqual(["voice"]);
  });

  it("maps authoritative type-specific details and sighting review state", () => {
    const view = toBroadcastDetailView({
      id: "broadcast-1",
      type: "StolenVehicle",
      metadata: { make: "Toyota", model: "Corolla", registrationNumber: "ABC-123", vin: "VIN-123", theftDescription: "Taken outside the office" },
      sightings: [{ id: "sighting-1", description: "Seen heading east", metadata: { reviewStatus: "Verified" }, media: [] }],
    });
    expect(view.stolenVehicle?.plateNumber).toBe("ABC-123");
    expect(view.stolenVehicle?.vin).toBe("VIN-123");
    expect(view.stolenVehicle?.theftAccount).toBe("Taken outside the office");
    expect(view.sightings?.[0]?.reviewStatus).toBe("Verified");
    expect(view.type).toBe("StolenVehicle");
  });

  it("includes approval and sighting events in the authoritative activity timeline", () => {
    const view = toBroadcastDetailView({
      id: "broadcast-1",
      type: "MissingPerson",
      authorType: "Citizen",
      requiresApproval: false,
      createdAt: "2026-08-23T12:38:00.000Z",
      publishedAt: "2026-08-23T12:40:00.000Z",
      sightings: [{ id: "sighting-1", createdAt: "2026-08-24T08:02:00.000Z", anonymousPublic: true, media: [] }],
    });
    expect(view.timeline.map((entry) => entry.label)).toEqual([
      "Broadcast submitted",
      "Broadcast approved",
      "Broadcast published",
      "Sighting reported (#1)",
    ]);
    expect(view.timeline.at(-1)?.actor).toBe("Anonymous");
  });

  it("formats delivery and validates actual target coordinates", () => {
    expect(deliverySummary(broadcast)).toBe("12 sent · 4 read");
    expect(hasBroadcastCoordinates(broadcast)).toBe(true);
    expect(formatBroadcastDate("not-a-date")).toBe("Not recorded");
  });

  it("keeps private media access and the real map in the detail workspace", () => {
    const workspace = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-detail-workspace.tsx"), "utf8");
    const sightings = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-sightings-section.tsx"), "utf8");
    const gallery = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-evidence-gallery.tsx"), "utf8");
    const map = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-detail-map.tsx"), "utf8");
    expect(gallery).toContain("/api/admin/broadcasts/${broadcastId}/media/${mediaId}/view");
    expect(workspace).toContain("Primary photo of the missing person");
    expect(workspace).toContain("Reference photos by angle");
    expect(workspace).toContain("Description of theft");
    expect(workspace).toContain("Broadcast rules &amp; help");
    expect(workspace).toContain('title="Last seen"');
    expect(workspace).toContain('title="Target location"');
    expect(sightings).toContain("Review sighting");
    expect(sightings).toContain('role="dialog"');
    expect(sightings).toContain("Sighting evidence — separate from the original broadcast evidence");
    expect(map).toContain('await import("leaflet")');
    expect(map).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(map).toContain("scrollWheelZoom: true");
    expect(map).toContain("Open Location");
    expect(map).toContain("© OpenStreetMap contributors");
  });

  it("matches the prototype action and section rules for citizen and Admin broadcasts", () => {
    const workspace = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-detail-workspace.tsx"), "utf8");
    const moderation = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-moderation-actions.tsx"), "utf8");
    const actions = readFileSync(join(process.cwd(), "components", "broadcast-actions.tsx"), "utf8");
    const actionRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "broadcasts", "[id]", "[action]", "route.ts"), "utf8");
    expect(workspace).toContain('broadcast.authorLabel === "Admin" ? <section');
    expect(workspace).toContain('detailMode="citizen"');
    expect(workspace).toContain("hideWhenEmpty");
    expect(moderation).toContain('authorLabel !== "Admin"');
    expect(actions).toContain('detailMode === "citizen"');
    expect(moderation).toContain("Withdrawn from admin workspace");
    expect(actions).toContain('"preview", "estimate", "progress"');
    expect(actionRoute).toContain("previewBroadcast(id)");
  });

  it("provides a routed full sighting review view", () => {
    const route = readFileSync(join(process.cwd(), "app", "broadcasts", "[id]", "sightings", "[sightingId]", "page.tsx"), "utf8");
    expect(route).toContain("Review Sighting");
    expect(route).toContain("Sighting evidence");
    expect(route).toContain("Review decisions remain server-authoritative");
  });
});
