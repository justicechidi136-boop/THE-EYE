import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { LoginDto, PhoneOtpVerifyDto, RegisterDto } from "../dto/auth.dto";

async function validateDto<T extends object>(cls: new () => T, plain: object) {
  const dto = plainToInstance(cls, plain);
  return validate(dto);
}

describe("auth DTO validation", () => {
  it("enforces password minimum length", async () => {
    const errors = await validateDto(LoginDto, {
      email: "citizen@theeye.local",
      password: "short",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts valid login payloads", async () => {
    const errors = await validateDto(LoginDto, {
      email: "citizen@theeye.local",
      password: "Password123!",
    });
    expect(errors.length).toBe(0);
  });

  it("requires OTP codes with minimum length", async () => {
    const errors = await validateDto(PhoneOtpVerifyDto, {
      phone: "+2348012345678",
      code: "12",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts valid registration payloads", async () => {
    const errors = await validateDto(RegisterDto, {
      email: "citizen@theeye.local",
      password: "Password123!",
      firstName: "Ada",
      lastName: "Okeke",
    });
    expect(errors.length).toBe(0);
  });

  it("rejects registration payloads missing names", async () => {
    const errors = await validateDto(RegisterDto, {
      email: "citizen@theeye.local",
      password: "Password123!",
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
