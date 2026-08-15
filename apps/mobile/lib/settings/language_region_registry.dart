import "package:flutter/widgets.dart";

import "../contracts/the_eye_enums.dart";

class CountryRegionOption {
  const CountryRegionOption({
    required this.code,
    required this.englishName,
    required this.nativeName,
    required this.enabled,
    this.flagEmoji,
  });

  final String code;
  final String englishName;
  final String nativeName;
  final bool enabled;
  final String? flagEmoji;

  String get displayName => englishName;

  String get selectorLabel {
    final flag = flagEmoji;
    return flag == null ? englishName : "$flag $englishName";
  }
}

class PreferredLanguageOption {
  const PreferredLanguageOption({
    required this.locale,
    required this.englishName,
    required this.nativeName,
    required this.enabled,
    required this.countries,
  });

  final String locale;
  final String englishName;
  final String nativeName;
  final bool enabled;
  final List<String> countries;

  String get displayName =>
      nativeName == englishName ? englishName : "$nativeName ($englishName)";
}

abstract final class LanguageRegionRegistry {
  static const defaultCountryCode = AccountCountryCode.nigeria;
  static const defaultPreferredLocale = PreferredLocale.english;

  static const countries = <CountryRegionOption>[
    CountryRegionOption(
      code: AccountCountryCode.nigeria,
      englishName: "Nigeria",
      nativeName: "Nigeria",
      enabled: true,
      flagEmoji: "🇳🇬",
    ),
  ];

  static const languages = <PreferredLanguageOption>[
    PreferredLanguageOption(
      locale: PreferredLocale.english,
      englishName: "English",
      nativeName: "English",
      enabled: true,
      countries: ["NG"],
    ),
    PreferredLanguageOption(
      locale: PreferredLocale.hausa,
      englishName: "Hausa",
      nativeName: "Hausa",
      enabled: true,
      countries: ["NG"],
    ),
    PreferredLanguageOption(
      locale: PreferredLocale.yoruba,
      englishName: "Yoruba",
      nativeName: "Yoruba",
      enabled: true,
      countries: ["NG"],
    ),
    PreferredLanguageOption(
      locale: PreferredLocale.igbo,
      englishName: "Igbo",
      nativeName: "Igbo",
      enabled: true,
      countries: ["NG"],
    ),
    PreferredLanguageOption(
      locale: PreferredLocale.nigerianPidgin,
      englishName: "Nigerian Pidgin",
      nativeName: "Nigerian Pidgin",
      enabled: true,
      countries: ["NG"],
    ),
  ];

  static List<CountryRegionOption> get enabledCountries =>
      countries.where((country) => country.enabled).toList(growable: false);

  static List<PreferredLanguageOption> get enabledLanguages =>
      languages.where((language) => language.enabled).toList(growable: false);

  static CountryRegionOption? countryByCode(String? code) {
    final normalized = code?.trim().toUpperCase();
    if (normalized == null || normalized.isEmpty) return null;
    for (final country in countries) {
      if (country.code == normalized) return country;
    }
    return null;
  }

  static CountryRegionOption? countryFromLegacyName(String? name) {
    final normalized = name?.trim().toLowerCase();
    if (normalized == null || normalized.isEmpty) return null;
    for (final country in countries) {
      if (country.englishName.toLowerCase() == normalized ||
          country.nativeName.toLowerCase() == normalized) {
        return country;
      }
    }
    return null;
  }

  static CountryRegionOption defaultCountry() =>
      countryByCode(defaultCountryCode) ?? enabledCountries.first;

  static PreferredLanguageOption? languageByLocale(String? locale) {
    final normalized = locale?.trim().toLowerCase();
    if (normalized == null || normalized.isEmpty) return null;
    for (final language in languages) {
      if (language.locale == normalized) return language;
    }
    return null;
  }

  static PreferredLanguageOption effectiveLanguage(String? locale) {
    return languageByLocale(locale) ??
        languageByLocale(defaultPreferredLocale) ??
        enabledLanguages.first;
  }

  static PreferredLanguageOption suggestedLanguage({
    required Iterable<Locale> deviceLocales,
    String? countryCode,
    String? cachedLocale,
    String? serverLocale,
  }) {
    final server = languageByLocale(serverLocale);
    if (server != null && server.enabled) return server;

    final cached = languageByLocale(cachedLocale);
    if (cached != null && cached.enabled) return cached;

    for (final locale in deviceLocales) {
      final match = languageByLocale(locale.languageCode);
      if (match != null && match.enabled) return match;
    }

    final country = countryByCode(countryCode);
    if (country != null) {
      final match = enabledLanguages.where(
        (language) =>
            language.locale == defaultPreferredLocale &&
            language.countries.contains(country.code),
      );
      if (match.isNotEmpty) return match.first;
    }

    return effectiveLanguage(null);
  }
}
