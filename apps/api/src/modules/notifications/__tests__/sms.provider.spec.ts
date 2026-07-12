import { ConfigService } from "@nestjs/config";
import { SmsProvider } from "../providers/sms.provider";

describe("SmsProvider", () => {
  it("returns a placeholder SMS receipt when the provider is disabled", async () => {
    const config = {
      get: (key: string, fallback?: string) => (key === "SMS_PROVIDER_DISABLED" ? "true" : fallback),
    } as ConfigService;
    const prisma = { user: { findUnique: async () => null } } as never;
    const provider = new SmsProvider(config, prisma);

    const result = await provider.send({
      channel: "sms",
      phone: "+2348000002002",
      title: "THE EYE SOS alert",
      body: "SOS triggered",
    });

    expect(result.status).toBe("Sent");
    expect(result.provider).toBe("sms-placeholder");
    expect(result.responsePayload?.placeholder).toBe(true);
  });
});
