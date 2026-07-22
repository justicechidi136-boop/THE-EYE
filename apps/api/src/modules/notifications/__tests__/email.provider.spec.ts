import { ConfigService } from "@nestjs/config";
import { EmailProvider } from "../providers/email.provider";

describe("EmailProvider", () => {
  it("throws when the provider is disabled instead of returning fake success", async () => {
    const config = {
      get: (key: string, fallback?: string) => (key === "EMAIL_PROVIDER_DISABLED" ? "true" : fallback),
    } as ConfigService;
    const prisma = {
      user: { findUnique: async () => ({ email: "citizen@theeye.local" }) },
      adminUser: { findUnique: async () => null },
    } as never;
    const provider = new EmailProvider(config, prisma);

    let caught: Error | undefined;
    try {
      await provider.send({
        channel: "email",
        userId: "user-1",
        title: "Incident update",
        body: "Your report was received",
      });
    } catch (error) {
      caught = error as Error;
    }

    expect(caught?.message).toContain("Email provider is disabled");
  });
});
