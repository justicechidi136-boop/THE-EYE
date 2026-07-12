import { isValidPhoneNumber, normalizePhoneNumber } from "../phone-normalize";

describe("normalizePhoneNumber", () => {
  it("normalizes Nigerian local numbers to E.164", () => {
    expect(normalizePhoneNumber("08012345678")).toBe("+2348012345678");
    expect(normalizePhoneNumber("2348012345678")).toBe("+2348012345678");
    expect(normalizePhoneNumber("+234 801 234 5678")).toBe("+2348012345678");
  });

  it("normalizes international numbers with country code", () => {
    expect(normalizePhoneNumber("+1 (415) 555-0101")).toBe("+14155550101");
  });

  it("rejects invalid phone numbers", () => {
    expect(normalizePhoneNumber("abc")).toBe("");
    expect(isValidPhoneNumber("123")).toBe(false);
  });
});
