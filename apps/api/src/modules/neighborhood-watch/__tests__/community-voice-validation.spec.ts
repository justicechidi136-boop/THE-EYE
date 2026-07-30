import { BadRequestException } from "@nestjs/common";
import {
  hasValidCommunityPostNarrative,
  validateCommunityComment,
  validatePost,
} from "../dto/neighborhood-watch.dto";

describe("Neighborhood Watch voice validation", () => {
  it("accepts voice-only community posts", () => {
    expect(() =>
      validatePost({
        type: "SuspiciousActivity",
        title: "Suspicious vehicle",
        media: [
          {
            mediaType: "Audio",
            bucket: "the-eye",
            objectKey: "evidence/community-1/file.m4a",
            contentType: "audio/mp4",
            fileHash: "sha256:abc",
            durationSeconds: 10,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects posts without narrative or media", () => {
    expect(() =>
      validatePost({
        type: "SuspiciousActivity",
        title: "Suspicious vehicle",
        body: "bad",
      }),
    ).toThrow(BadRequestException);
  });

  it("accepts voice-only comments", () => {
    expect(() =>
      validateCommunityComment({
        media: [
          {
            mediaType: "Audio",
            bucket: "the-eye",
            objectKey: "evidence/community-1/file.m4a",
            contentType: "audio/mp4",
            fileHash: "sha256:def",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("hasValidCommunityPostNarrative accepts image without text", () => {
    expect(
      hasValidCommunityPostNarrative({
        body: "",
        media: [
          {
            mediaType: "Image",
            bucket: "the-eye",
            objectKey: "evidence/community-1/file.jpg",
            contentType: "image/jpeg",
            fileHash: "sha256:ghi",
          },
        ],
      }),
    ).toBe(true);
  });
});
