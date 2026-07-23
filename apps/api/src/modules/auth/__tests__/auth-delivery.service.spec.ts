import { ServiceUnavailableException } from "@nestjs/common";
import { AuthDeliveryService } from "../auth-delivery.service";

function createService(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string, fallback?: string) => env[key] ?? fallback,
  };
  const previousNodeEnv = process.env.NODE_ENV;
  if (env.NODE_ENV !== undefined) {
    process.env.NODE_ENV = env.NODE_ENV;
  }
  const service = new AuthDeliveryService(config as never);
  return {
    service,
    restore() {
      process.env.NODE_ENV = previousNodeEnv;
    },
  };
}

describe("AuthDeliveryService", () => {
  it("posts password reset payloads to the configured webhook when SMTP is unavailable", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as never;

    const { service, restore } = createService({
      NODE_ENV: "staging",
      THE_EYE_APP_ENV: "staging",
      AUTH_PASSWORD_RESET_WEBHOOK_URL: "https://delivery.example/password-reset",
    });

    await service.sendPasswordResetEmail("citizen@theeye.local", "reset-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://delivery.example/password-reset");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body).toEqual({
      type: "password_reset",
      email: "citizen@theeye.local",
      token: "reset-token",
    });
    expect(Object.keys(body).length).toBe(3);
    restore();
  });

  it("posts minimal OTP payloads and optional signing header", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as never;

    const { service, restore } = createService({
      NODE_ENV: "staging",
      THE_EYE_APP_ENV: "staging",
      AUTH_PHONE_OTP_WEBHOOK_URL: "https://delivery.example/phone-otp",
      AUTH_DELIVERY_WEBHOOK_SECRET: "staging-secret",
    });

    await service.sendPhoneOtp("+2348012345678", "123456", "login");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-the-eye-delivery-secret"]).toBe("staging-secret");
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body).toEqual({
      type: "phone_otp",
      phone: "+2348012345678",
      code: "123456",
      purpose: "login",
    });
    restore();
  });

  it("rejects OTP delivery when no provider or webhook is configured outside development", async () => {
    const { service, restore } = createService({
      NODE_ENV: "staging",
      ALLOW_DEV_AUTH_CODES: "false",
    });

    await expect(
      service.sendPhoneOtp("+2348012345678", "123456", "login"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    restore();
  });

  it("rejects insecure HTTP webhook URLs in staging", async () => {
    const { service, restore } = createService({
      NODE_ENV: "staging",
      THE_EYE_APP_ENV: "staging",
      AUTH_PASSWORD_RESET_WEBHOOK_URL: "http://delivery.example/password-reset",
    });

    await expect(
      service.sendPasswordResetEmail("citizen@theeye.local", "reset-token"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    restore();
  });
});
