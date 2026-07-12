import { ConfigService } from "@nestjs/config";
import { EmailProvider } from "../providers/email.provider";

describe("EmailProvider", () => {
  it("returns a placeholder email receipt when the provider is disabled", async () => {
    const config = {
      get: (key: string, fallback?: string) => (key === "EMAIL_PROVIDER_DISABLED" ? "true" : fallback),
    } as ConfigService;
    const prisma = {
      user: { findUnique: async () => ({ email: "citizen@theeye.local" }) },
      adminUser: { findUnique: async () => null },
    } as never;
    const provider = new EmailProvider(config, prisma);

    const result = await provider.send({
      channel: "email",
      userId: "user-1",
      title: "Incident update",
      body: "Your report was received",
    });

    expect(result.status).toBe("Sent");
    expect(result.provider).toBe("email-placeholder");
    expect(result.responsePayload?.placeholder).toBe(true);
  });
});
