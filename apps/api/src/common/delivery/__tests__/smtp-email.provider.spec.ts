import { SmtpEmailProvider } from "../smtp-email.provider";

function createProvider(env: Record<string, string | undefined>) {
  return new SmtpEmailProvider({
    get: (key: string, fallback?: string) => env[key] ?? fallback,
  } as never);
}

describe("SmtpEmailProvider", () => {
  it("fails closed when SMTP is not configured", async () => {
    const provider = createProvider({});
    expect(provider.isConfigured()).toBe(false);
    const result = await provider.send({
      to: "citizen@theeye.local",
      subject: "Reset",
      text: "token",
    });
    expect(result.status).toBe("Failed");
    expect(result.metadata?.reason).toBe("smtp_not_configured");
  });

  it("reports configured when required SMTP env vars are present", () => {
    const provider = createProvider({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USERNAME: "security@theeye.com.ng",
      SMTP_PASSWORD: "secret",
      SMTP_FROM_EMAIL: "security@theeye.com.ng",
    });
    expect(provider.isConfigured()).toBe(true);
  });
});
