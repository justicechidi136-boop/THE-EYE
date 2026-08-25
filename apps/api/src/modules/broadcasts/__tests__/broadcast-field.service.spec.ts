import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BroadcastStatus } from "@the-eye/shared";
import { createMetricsMock } from "../../../common/metrics/metrics.test-utils";
import { BroadcastsService } from "../broadcasts.service";

function buildService(prisma: Record<string, unknown>) {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new BroadcastsService(
    prisma as any,
    { enqueue: jest.fn() } as any,
    auditService as any,
    createMetricsMock(),
    { getHealth: jest.fn() } as any,
  );
  return { service, auditService };
}

const fieldActor = {
  typ: "field",
  sub: "0f3c3d78-7dce-4d72-8d71-1fb35a979d34",
  permissions: ["field:session:operate", "incident:read"],
  country: "Nigeria",
  state: "Lagos",
  lga: "Ikeja",
  fieldRole: "PatrolOfficer",
  fieldDeviceId: "device-1",
};

describe("BroadcastsService field operations", () => {
  it("submits a location-scoped field broadcast for approval", async () => {
    const prisma = {
      broadcast: {
        create: jest.fn().mockResolvedValue({
          id: "broadcast-1",
          status: BroadcastStatus.PendingApproval,
        }),
      },
      broadcastMedia: {
        create: jest.fn().mockResolvedValue({ id: "media-1" }),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: "jurisdiction-1" }]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    const { service, auditService } = buildService(prisma);

    const result = await service.createFromField(
      {
        type: "CommunityWarning",
        title: "Road closure ahead",
        body: "Avoid the affected road while responders clear the scene.",
        priority: "P3SuspiciousActivity",
        latitude: 6.6018,
        longitude: 3.3515,
        radiusMeters: 5000,
        attachments: [
          {
            mediaType: "image",
            contentType: "image/jpeg",
            sizeBytes: 1024,
            bucket: "staging-private",
            objectKey: `evidence/broadcast-field-${fieldActor.sub}/photo.jpg`,
            clientAttachmentId: "photo-1",
          },
        ],
      } as any,
      fieldActor as any,
    );

    expect(result.data.status).toBe(BroadcastStatus.PendingApproval);
    expect(prisma.broadcast.create.mock.calls[0]?.[0]?.data).toEqual(
      expect.objectContaining({
        creatorAdminId: fieldActor.sub,
        country: "Nigeria",
        state: "Lagos",
        lga: "Ikeja",
        status: BroadcastStatus.PendingApproval,
        requiresApproval: true,
        autoPublished: false,
        publishedAt: undefined,
      }),
    );
    expect(auditService.record.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        action: "broadcast.field_submitted",
        entityId: "broadcast-1",
      }),
    );
    expect(prisma.broadcastMedia.create.mock.calls[0]?.[0]?.data).toEqual(
      expect.objectContaining({
        broadcastId: "broadcast-1",
        uploaderId: null,
        uploaderAdminId: fieldActor.sub,
        mediaType: "Image",
        objectKey: `evidence/broadcast-field-${fieldActor.sub}/photo.jpg`,
      }),
    );
  });

  it("rejects evidence outside the authenticated field uploader prefix", async () => {
    const { service } = buildService({});
    await expect(
      service.createFromField(
        {
          type: "CommunityWarning",
          title: "Road closure ahead",
          body: "Avoid the affected road while responders clear the scene.",
          priority: "P3SuspiciousActivity",
          latitude: 6.6018,
          longitude: 3.3515,
          attachments: [
            {
              mediaType: "video",
              contentType: "video/mp4",
              sizeBytes: 2048,
              bucket: "staging-private",
              objectKey: "evidence/broadcast-field-another-officer/video.mp4",
            },
          ],
        } as any,
        fieldActor as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("does not allow a field tablet to create admin-only categories", async () => {
    const { service } = buildService({});
    await expect(
      service.createFromField(
        {
          type: "GovernmentAlert",
          title: "Official government notice",
          body: "This category remains restricted to authorized administrators.",
          priority: "P4GeneralSafety",
          latitude: 6.6018,
          longitude: 3.3515,
        } as any,
        fieldActor as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects creation without an authenticated field session", async () => {
    const { service } = buildService({});
    await expect(
      service.createFromField({} as any, { ...fieldActor, typ: "admin" } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it("loads the live feed using field-session country scope", async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const { service } = buildService(prisma);

    const result = await service.countryFeed(fieldActor as any, { limit: 20 });

    expect(result.data).toEqual([]);
    expect(prisma.$queryRawUnsafe.mock.calls[0]?.[1]).toBe("Nigeria");
    expect(String(prisma.$queryRawUnsafe.mock.calls[0]?.[0])).toContain(
      "COALESCE(b.country, j.country) = $1",
    );
    expect(String(prisma.$queryRawUnsafe.mock.calls[0]?.[0])).not.toContain(
      "LEFT JOIN profiles",
    );
  });
});
