import { readFileSync } from "node:fs";
import { join } from "node:path";
import { humanLocation, humanPriority, sanitizeLocationTrail } from "../admin-presentation";
import { toBroadcastDetailView, toIncidentView, toLiveVideoSessionView } from "../mappers";

describe("admin dashboard remediation", () => {
  it("uses human-readable priority without changing stored operational values", () => {
    expect(humanPriority("P1LifeThreatening")).toBe("HIGH");
    expect(humanPriority("P2")).toBe("MID");
    expect(humanPriority("P3SuspiciousActivity")).toBe("LOW");
    expect(humanPriority("P4")).toBe("LOW");
  });

  it("deduplicates inaccurate or impossible movement points", () => {
    const trail = sanitizeLocationTrail([
      { latitude: 6.5244, longitude: 3.3792, accuracyMeters: 10, capturedAt: "2026-08-27T10:00:00Z" },
      { latitude: 6.5244, longitude: 3.3792, accuracyMeters: 10, capturedAt: "2026-08-27T10:00:05Z" },
      { latitude: 7.5, longitude: 4.5, accuracyMeters: 10, capturedAt: "2026-08-27T10:00:10Z" },
      { latitude: 6.525, longitude: 3.38, accuracyMeters: 20, capturedAt: "2026-08-27T10:01:00Z" },
      { latitude: 6.526, longitude: 3.381, accuracyMeters: 900, capturedAt: "2026-08-27T10:02:00Z" },
    ]);
    expect(trail.length).toBe(2);
    expect(trail[1].latitude).toBe(6.525);
  });

  it("maps broadcast detail, private media types, and safe location hierarchy", () => {
    const view = toBroadcastDetailView({
      id: "broadcast-1",
      title: "Missing person",
      body: "Please help",
      type: "MissingPerson",
      state: "Lagos",
      lga: "Ikeja",
      metadata: { lastSeenAddress: "Airport Road", fullName: "Ada Example" },
      media: [
        { id: "image-1", mediaType: "Image", role: "Photo", contentType: "image/jpeg" },
        { id: "video-1", mediaType: "Video", role: "Video", contentType: "video/mp4" },
        { id: "audio-1", mediaType: "Audio", role: "Voice", contentType: "audio/mp4" },
      ],
    });
    expect(view.location).toBe("Airport Road, Ikeja, Lagos");
    expect(view.attachments.map((item) => item.id).join(",")).toBe("image-1,video-1,audio-1");
    expect(view.attachments.map((item) => item.mediaType).join(",")).toBe("image,video,audio");
    expect(view.details[0].value).toBe("Ada Example");
  });

  it("preserves anonymous reporter privacy while exposing authorized identified labels", () => {
    const anonymous = toIncidentView({ id: "i-1", isAnonymous: true, locationUpdates: [], reporter: { id: "private" } });
    const identified = toLiveVideoSessionView({
      id: "s-1",
      incident: { id: "i-2", reporterId: "12345678-private", reporter: { profile: { firstName: "Ada", lastName: "Okafor" } }, address: "Allen Avenue", lga: "Ikeja", state: "Lagos" },
      locationUpdates: [],
    });
    expect(anonymous.reporter.accountReference).toBe(null);
    expect(identified.reporter).toBe("Ada Okafor");
    expect(identified.location).toBe("Allen Avenue, Ikeja, Lagos");
    expect(humanLocation([])).toBe("Location unavailable");
  });

  it("uses scoped detail and fresh authorized media-read routes", () => {
    const data = readFileSync(join(process.cwd(), "lib", "api", "data.ts"), "utf8");
    const page = readFileSync(join(process.cwd(), "app", "broadcasts", "[id]", "page.tsx"), "utf8");
    expect(data).toContain("/admin/broadcasts/${encodeURIComponent(id)}");
    expect(page).toContain("/api/admin/broadcasts/${broadcast.id}/media/${mediaId}/view");
    expect(page).toContain("mediaAccessPath");
  });

    it("renders real road tiles and a chronological polylined trail", () => {
      const map = readFileSync(join(process.cwd(), "components", "location-trail-map.tsx"), "utf8");
      expect(map).toContain("tile.openstreetmap.org");
      expect(map).toContain("© OpenStreetMap contributors");
      expect(map.includes("<iframe")).toBe(false);
      expect(map).toContain("<polyline");
    expect(map).toContain("sanitizeLocationTrail");
    expect(map.includes("leaflet-grid")).toBe(false);
    expect(map).toContain("setInterval(refresh, 5000)");
  });
});
