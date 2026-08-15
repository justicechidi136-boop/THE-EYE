export type CountryCode = "NG";

export type PreferredLocale = "en" | "ha" | "yo" | "ig" | "pcm";

export type CountryRegistryEntry = {
  code: CountryCode;
  englishName: string;
  nativeName: string;
  enabled: boolean;
};

export type LanguageRegistryEntry = {
  locale: PreferredLocale;
  englishName: string;
  nativeName: string;
  enabled: boolean;
  countries: readonly CountryCode[];
  speechToTextSupported: boolean;
  translationSupported: boolean;
  textToSpeechSupported: boolean;
};

export const DEFAULT_COUNTRY_CODE: CountryCode = "NG";
export const DEFAULT_PREFERRED_LOCALE: PreferredLocale = "en";

export const COUNTRY_REGISTRY: readonly CountryRegistryEntry[] = [
  {
    code: "NG",
    englishName: "Nigeria",
    nativeName: "Nigeria",
    enabled: true,
  },
] as const;

export const LANGUAGE_REGISTRY: readonly LanguageRegistryEntry[] = [
  {
    locale: "en",
    englishName: "English",
    nativeName: "English",
    enabled: true,
    countries: ["NG"],
    speechToTextSupported: false,
    translationSupported: false,
    textToSpeechSupported: false,
  },
  {
    locale: "ha",
    englishName: "Hausa",
    nativeName: "Hausa",
    enabled: true,
    countries: ["NG"],
    speechToTextSupported: false,
    translationSupported: false,
    textToSpeechSupported: false,
  },
  {
    locale: "yo",
    englishName: "Yoruba",
    nativeName: "Yoruba",
    enabled: true,
    countries: ["NG"],
    speechToTextSupported: false,
    translationSupported: false,
    textToSpeechSupported: false,
  },
  {
    locale: "ig",
    englishName: "Igbo",
    nativeName: "Igbo",
    enabled: true,
    countries: ["NG"],
    speechToTextSupported: false,
    translationSupported: false,
    textToSpeechSupported: false,
  },
  {
    locale: "pcm",
    englishName: "Nigerian Pidgin",
    nativeName: "Nigerian Pidgin",
    enabled: true,
    countries: ["NG"],
    speechToTextSupported: false,
    translationSupported: false,
    textToSpeechSupported: false,
  },
] as const;

export function normalizeCountryCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function normalizePreferredLocale(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function findCountry(code: string | null | undefined): CountryRegistryEntry | undefined {
  const normalized = normalizeCountryCode(code);
  return COUNTRY_REGISTRY.find((entry) => entry.code === normalized);
}

export function findLanguage(locale: string | null | undefined): LanguageRegistryEntry | undefined {
  const normalized = normalizePreferredLocale(locale);
  return LANGUAGE_REGISTRY.find((entry) => entry.locale === normalized);
}

export function isEnabledCountryCode(code: string | null | undefined): code is CountryCode {
  return findCountry(code)?.enabled === true;
}

export function isEnabledPreferredLocale(locale: string | null | undefined): locale is PreferredLocale {
  return findLanguage(locale)?.enabled === true;
}

export function effectivePreferredLocale(locale: string | null | undefined): PreferredLocale {
  const normalized = normalizePreferredLocale(locale);
  return isEnabledPreferredLocale(normalized) ? normalized : DEFAULT_PREFERRED_LOCALE;
}
