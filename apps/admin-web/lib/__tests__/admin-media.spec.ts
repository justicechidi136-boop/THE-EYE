import {
  displayEvidenceLabel,
  mediaTypeFromContentType,
  normalizeBroadcastAttachments,
  validateAdminEvidenceSelection,
} from "../admin-media";

describe("admin media helpers", () => {
  it("classifies supported evidence content types", () => {
    expect(mediaTypeFromContentType("image/jpeg")).toBe("Image");
    expect(mediaTypeFromContentType("video/mp4")).toBe("Video");
    expect(mediaTypeFromContentType("audio/mp4")).toBe("Audio");
    expect(mediaTypeFromContentType("application/pdf")).toBe(null);
  });

  it("rejects unsupported or excessive create-case media", () => {
    expect(validateAdminEvidenceSelection([{ type: "audio/wav", size: 1000 }], ["Audio"])).toContain("Unsupported");
    expect(validateAdminEvidenceSelection([{ type: "image/png", size: 101 * 1024 * 1024 }], ["Image"])).toContain("100 MB");
    expect(validateAdminEvidenceSelection([
      { type: "video/mp4", size: 1000 },
      { type: "video/mp4", size: 1000 },
      { type: "video/mp4", size: 1000 },
    ], ["Video"])).toContain("At most 2");
  });

  it("normalizes broadcast preview attachments without exposing object keys", () => {
    const attachments = normalizeBroadcastAttachments([
      { mediaType: "image", label: "Photo 1", contentType: "image/jpeg", url: "https://storage.example/signed" },
      { mediaType: "document", label: "Nope", objectKey: "evidence/private/file.pdf" },
    ]);
    expect(attachments.length).toBe(1);
    expect(attachments[0].label).toBe("Photo 1");
    expect(JSON.stringify(attachments)).toContain("https://storage.example/signed");
    expect(JSON.stringify(attachments).includes("objectKey")).toBe(false);
  });

  it("uses friendly evidence labels instead of storage keys", () => {
    expect(displayEvidenceLabel({ type: "Image", name: "evidence/case/private.jpg" })).toBe("Photo evidence");
    expect(displayEvidenceLabel({ type: "Audio", contentType: "audio/mp4" })).toBe("Voice evidence");
  });
});
