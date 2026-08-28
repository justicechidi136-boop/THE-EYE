import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deliverySummary, formatBroadcastDate, hasBroadcastCoordinates, splitBroadcastMedia } from "../broadcast-detail-presentation";

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

  it("formats delivery and validates actual target coordinates", () => {
    expect(deliverySummary(broadcast)).toBe("12 sent · 4 read");
    expect(hasBroadcastCoordinates(broadcast)).toBe(true);
    expect(formatBroadcastDate("not-a-date")).toBe("Not recorded");
  });

  it("keeps private media access and the real map in the detail workspace", () => {
    const workspace = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-detail-workspace.tsx"), "utf8");
    const gallery = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-evidence-gallery.tsx"), "utf8");
    const map = readFileSync(join(process.cwd(), "components", "broadcast", "broadcast-detail-map.tsx"), "utf8");
    expect(gallery).toContain("/api/admin/broadcasts/${broadcastId}/media/${mediaId}/view");
    expect(workspace).toContain("Sightings reported");
    expect(workspace).toContain("Broadcast rules &amp; help");
    expect(map).toContain("https://tile.openstreetmap.org");
    expect(map).toContain("© OpenStreetMap contributors");
  });
});
