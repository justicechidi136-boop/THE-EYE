import { NotFoundException } from "@nestjs/common";
import { BroadcastAdminService } from "../broadcast-admin.service";

function buildService() {
  const prisma = {
    broadcast: { findFirst: jest.fn() },
    broadcastMedia: { findFirst: jest.fn() },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new BroadcastAdminService(
    prisma as any,
    audit as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, prisma, audit };
}

const stateAdmin = {
  typ: "admin",
  sub: "admin-1",
  role: "State Admin",
  country: "NG",
  state: "Lagos",
  permissions: ["broadcast:create"],
} as any;

describe("BroadcastAdminService detail and media", () => {
  it("loads an in-scope detail with persisted image, video, and audio", async () => {
    const { service, prisma } = buildService();
    prisma.broadcast.findFirst.mockResolvedValue({
      id: "broadcast-1",
      country: "NG",
      media: [
        { id: "image", mediaType: "Image" },
        { id: "video", mediaType: "Video" },
        { id: "audio", mediaType: "Audio" },
      ],
    });
    const result = await service.getDetail("broadcast-1", stateAdmin);
    expect(result.data.media.map((item: any) => item.mediaType)).toEqual(["Image", "Video", "Audio"]);
    expect(prisma.broadcast.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "broadcast-1", deletedAt: null }),
    }));
    const detailQuery = prisma.broadcast.findFirst.mock.calls[0]?.[0];
    expect(detailQuery.include.media.select).toEqual({
      id: true,
      mediaType: true,
      role: true,
      contentType: true,
      durationSeconds: true,
    });
    expect(Object.prototype.hasOwnProperty.call(detailQuery.include.media.select, "sizeBytes")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(detailQuery.include.sightings, "include")).toBe(false);
  });

  it("returns not found for out-of-scope detail without leaking existence", async () => {
    const { service, prisma } = buildService();
    prisma.broadcast.findFirst.mockResolvedValue(null);
    await expect(service.getDetail("outside", stateAdmin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("includes state scope in detail lookup", async () => {
    const { service, prisma } = buildService();
    prisma.broadcast.findFirst.mockResolvedValue({ id: "broadcast-1", media: [] });
    await service.getDetail("broadcast-1", stateAdmin);
    const where = prisma.broadcast.findFirst.mock.calls[0]?.[0]?.where;
    expect(where.OR).toEqual(expect.arrayContaining([
      expect.objectContaining({ country: "NG", state: "Lagos" }),
    ]));
  });

  it("creates a fresh bounded signed read for the exact authorized media record", async () => {
    const { service, prisma, audit } = buildService();
    prisma.broadcast.findFirst.mockResolvedValue({ id: "broadcast-1" });
    prisma.broadcastMedia.findFirst.mockResolvedValue({
      id: "audio-1",
      broadcastId: "broadcast-1",
      objectKey: "evidence/broadcast-1/audio.m4a",
      mediaType: "Audio",
      contentType: "audio/mp4",
      durationSeconds: 10,
    });
    (service as any).signDownloadUrl = jest.fn().mockResolvedValue({
      url: "https://storage.googleapis.com/private-signed",
      expiresInSeconds: 300,
    });
    const result = await service.viewMedia("broadcast-1", "audio-1", stateAdmin);
    expect(result.expiresInSeconds).toBe(300);
    expect(result.data.id).toBe("audio-1");
    expect((service as any).signDownloadUrl).toHaveBeenCalledWith("evidence/broadcast-1/audio.m4a", 300);
    expect(audit.record).toHaveBeenCalled();
  });
});
