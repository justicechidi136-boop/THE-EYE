import { ConfigService } from "@nestjs/config";
import { SmsProvider } from "../providers/sms.provider";

describe("SmsProvider", () => {
  it("throws when the provider is disabled instead of returning fake success", async () => {
    const config = {
      get: (key: string, fallback?: string) => (key === "SMS_PROVIDER_DISABLED" ? "true" : fallback),
    } as ConfigService;
    const prisma = { user: { findUnique: async () => null } } as never;
    const provider = new SmsProvider(config, prisma);

    let caught: Error | undefined;
    try {
      await provider.send({
        channel: "sms",
        phone: "+2348000002002",
        title: "THE EYE SOS alert",
        body: "SOS triggered",
      });
    } catch (error) {
      caught = error as Error;
    }

    expect(caught?.message).toContain("SMS provider is disabled");
  });
});
