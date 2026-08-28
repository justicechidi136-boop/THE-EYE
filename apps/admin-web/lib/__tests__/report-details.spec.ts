import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildReportActivity,
  evidenceAccessSentence,
  evidenceDisplayLabel,
  reportDetailsTitle,
  reportPublicReference,
  summarizeEvidenceAccess,
} from "../report-details-presentation";
import type { Incident } from "../types/admin-views";

const report = {
  id: "9b0d7b25-9b5f-4a83-8fe3-14079045ae7c",
  createdAt: "2026-08-28T10:00:00.000Z",
  type: "Fire",
  location: "Stadium Road, Port Harcourt, Rivers State",
  reporter: { anonymous: false, label: "John Doe", accountReference: null },
} as Incident;

describe("Report Details presentation", () => {
  it("uses a public reference and human-readable title without exposing the UUID", () => {
    expect(reportPublicReference(report)).toBe("EYE-260828-AE7C");
    expect(reportDetailsTitle(report)).toBe("Fire report — Stadium Road, Port Harcourt, Rivers State");
  });

  it("labels photo, video, and voice evidence directly", () => {
    expect(evidenceDisplayLabel({ type: "Image", contentType: "image/jpeg" })).toBe("Photo Evidence");
    expect(evidenceDisplayLabel({ type: "Video", contentType: "video/mp4" })).toBe("Video Evidence");
    expect(evidenceDisplayLabel({ type: "Audio", contentType: "audio/m4a" })).toBe("Voice Evidence");
  });

  it("humanizes and deduplicates report progress", () => {
    const activity = buildReportActivity([
      { at: report.createdAt, type: "report.submitted", label: "Emergency report submitted" },
      { at: report.createdAt, type: "incident.submitted", label: "incident.submitted" },
      { at: report.createdAt, type: "incident.media_attached", details: { media: { id: "media-1", mediaType: "Image", contentType: "image/jpeg" } } },
    ], report.type);
    expect(activity).toEqual([
      { at: report.createdAt, label: "Fire report submitted", category: "progress" },
      { at: report.createdAt, label: "Photo Evidence", category: "evidence" },
    ]);
  });

  it("uses the authorized reporter name without exposing an object key", () => {
    expect(evidenceAccessSentence({ actor: "user", action: "Viewed", file: "evidence/private/photo.jpg", time: "12:27" }, report)).toBe("John Doe viewed Photo Evidence");
  });

  it("deduplicates repeated evidence access activity", () => {
    const entry = { actor: "admin", action: "Viewed", file: "evidence/private/photo.jpg", time: "12:27" };
    expect(summarizeEvidenceAccess([entry, entry], report)).toEqual([{ sentence: "Administrator viewed Photo Evidence", time: "12:27" }]);
  });

  it("uses an agency selector and removes the freeform agency identifier", () => {
    const actions = readFileSync(resolve(__dirname, "../../components/incident-admin-actions.tsx"), "utf8");
    const detail = readFileSync(resolve(__dirname, "../../app/incidents/[id]/page.tsx"), "utf8");
    expect(actions).toContain("Select agency…");
    expect(detail).toContain("agencies={agencies}");
  });
});
