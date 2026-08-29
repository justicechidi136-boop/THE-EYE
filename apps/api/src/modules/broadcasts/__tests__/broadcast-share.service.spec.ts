import { BroadcastStatus, BroadcastType } from "@the-eye/shared";
import {
  BroadcastShareService,
  resolvePublicBroadcastShareBaseUrl,
} from "../broadcast-share.service";

describe("BroadcastShareService", () => {
  it("builds a stable staging web/deep link and redacts private vehicle data", async () => {
    const prisma = {
      broadcast: {
        findFirst: jest.fn().mockResolvedValue({
          id: "broadcast-42",
          type: BroadcastType.StolenVehicle,
          status: BroadcastStatus.Active,
          title: "Stolen vehicle: Toyota Corolla (***53RT)",
          body: "Internal body",
          metadata: {
            make: "Toyota",
            model: "Corolla",
            registrationNumber: "TTT53RT",
            registrationMasked: "***53RT",
            vin: "PRIVATE-VIN",
            lastSeenAt: "2026-08-13T13:45:00.000Z",
            lastKnownLocation: "Ikeja, Lagos",
          },
          authorType: "Citizen",
          adminVerified: false,
          country: "NG",
          state: "Lagos",
          publishedAt: new Date("2026-08-13T13:50:00.000Z"),
          createdAt: new Date("2026-08-13T13:49:00.000Z"),
          expiresAt: new Date("2026-09-13T13:50:00.000Z"),
          deletedAt: null,
        }),
      },
    } as any;
    const previousEnv = process.env.THE_EYE_APP_ENV;
    process.env.THE_EYE_APP_ENV = "staging";
    try {
      const result = await new BroadcastShareService(prisma).getPublicShare(
        "broadcast-42",
      );
      expect(result.data.shareUrl).toBe(
        "https://staging-dashboard8jps.theeye.com.ng/share/broadcasts/broadcast-42",
      );
      expect(result.data.deepLink).toBe(result.data.shareUrl);
      expect(result.data.shareText).toContain("View full broadcast:");
      expect(result.data.shareText).toContain("🚨 Stolen Vehicle Alert");
      expect(result.data.shareText).toContain(
        "Stolen vehicle: Toyota Corolla (***53RT)",
      );
      expect(result.data.shareText).toContain(
        "Last known location: Ikeja, Lagos",
      );
      expect(result.data.shareText).not.toContain("\nLocation:");
      expect(result.data.shareText).not.toContain("PRIVATE-VIN");
      expect(result.data.shareText).not.toContain("TTT53RT");
      expect(JSON.stringify(result.data)).not.toContain("PRIVATE-VIN");
    } finally {
      process.env.THE_EYE_APP_ENV = previousEnv;
    }
  });

  it("requires HTTPS for configured deployable public share origins", () => {
    let thrown: unknown;
    try {
      resolvePublicBroadcastShareBaseUrl({
        NODE_ENV: "production",
        PUBLIC_BROADCAST_SHARE_BASE_URL: "http://dashboard.theeye.com.ng",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("must use HTTPS");
  });
});
