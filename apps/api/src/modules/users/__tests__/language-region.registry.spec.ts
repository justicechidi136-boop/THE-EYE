import {
  COUNTRY_REGISTRY,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_PREFERRED_LOCALE,
  LANGUAGE_REGISTRY,
  effectivePreferredLocale,
  isEnabledCountryCode,
  isEnabledPreferredLocale,
  SpokenLanguageCode,
} from "@the-eye/shared";

describe("language and region registry", () => {
  it("defines Nigeria and the initial Nigerian language set", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("NG");
    expect(COUNTRY_REGISTRY.map((entry) => entry.code)).toEqual(["NG"]);
    expect(LANGUAGE_REGISTRY.map((entry) => entry.locale)).toEqual(["en", "ha", "yo", "ig", "pcm"]);
    expect(LANGUAGE_REGISTRY.every((entry) => entry.enabled)).toBe(true);
  });

  it("defaults unsupported or missing locale values to English", () => {
    expect(DEFAULT_PREFERRED_LOCALE).toBe("en");
    expect(effectivePreferredLocale(null)).toBe("en");
    expect(effectivePreferredLocale("HAUSA")).toBe("en");
    expect(effectivePreferredLocale("ha")).toBe("ha");
  });

  it("keeps account locale distinct from smartwatch spoken-language tags", () => {
    expect(isEnabledCountryCode("ng")).toBe(true);
    expect(isEnabledPreferredLocale("HA")).toBe(true);
    expect(SpokenLanguageCode.Hausa).toBe("ha-NG");
  });
});
