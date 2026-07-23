import { TermiiSmsProvider } from "../termii-sms.provider";

function createProvider(env: Record<string, string | undefined>) {
  return new TermiiSmsProvider({
    get: (key: string, fallback?: string) => env[key] ?? fallback,
  } as never);
}

describe("TermiiSmsProvider", () => {
  it("fails closed when Termii is not configured", async () => {
    const provider = createProvider({});
    expect(provider.isConfigured()).toBe(false);
    const result = await provider.send({
      to: "+2348012345678",
      text: "Your code is 123456",
      purpose: "login",
    });
    expect(result.status).toBe("Failed");
    expect(result.metadata?.reason).toBe("termii_not_configured");
  });

  it("reports configured when Termii env vars are present", () => {
    const provider = createProvider({
      SMS_PROVIDER: "termii",
      TERMII_API_KEY: "termii-key",
      TERMII_SENDER_ID: "THE EYE",
    });
    expect(provider.isConfigured()).toBe(true);
  });

  it("returns retryable failure when Termii API responds with server error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as never;

    const provider = createProvider({
      SMS_PROVIDER: "termii",
      TERMII_API_KEY: "termii-key",
      TERMII_SENDER_ID: "THE EYE",
    });
    const result = await provider.send({
      to: "+2348012345678",
      text: "Your code is 123456",
      purpose: "login",
    });
    expect(result.status).toBe("Failed");
    expect(result.retryable).toBe(true);
  });
});
