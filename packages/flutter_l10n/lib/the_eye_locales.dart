import "package:flutter/cupertino.dart";
import "package:flutter/foundation.dart";
import "package:flutter/material.dart";

abstract final class TheEyeLocaleCodes {
  static const english = "en";
  static const hausa = "ha";
  static const yoruba = "yo";
  static const igbo = "ig";
  static const nigerianPidgin = "pcm";
}

class TheEyeLocaleOption {
  const TheEyeLocaleOption({
    required this.code,
    required this.englishName,
    required this.nativeName,
    required this.enabled,
    required this.countries,
  });

  final String code;
  final String englishName;
  final String nativeName;
  final bool enabled;
  final List<String> countries;

  Locale get locale => Locale(code);
}

abstract final class TheEyeLocaleCatalog {
  static const defaultLocaleCode = TheEyeLocaleCodes.english;
  static const defaultLocale = Locale(defaultLocaleCode);

  static const supported = <TheEyeLocaleOption>[
    TheEyeLocaleOption(
      code: TheEyeLocaleCodes.english,
      englishName: "English",
      nativeName: "English",
      enabled: true,
      countries: ["NG"],
    ),
    TheEyeLocaleOption(
      code: TheEyeLocaleCodes.hausa,
      englishName: "Hausa",
      nativeName: "Hausa",
      enabled: true,
      countries: ["NG"],
    ),
    TheEyeLocaleOption(
      code: TheEyeLocaleCodes.yoruba,
      englishName: "Yoruba",
      nativeName: "Yoruba",
      enabled: true,
      countries: ["NG"],
    ),
    TheEyeLocaleOption(
      code: TheEyeLocaleCodes.igbo,
      englishName: "Igbo",
      nativeName: "Igbo",
      enabled: true,
      countries: ["NG"],
    ),
    TheEyeLocaleOption(
      code: TheEyeLocaleCodes.nigerianPidgin,
      englishName: "Nigerian Pidgin",
      nativeName: "Nigerian Pidgin",
      enabled: true,
      countries: ["NG"],
    ),
  ];

  static List<TheEyeLocaleOption> get enabled =>
      supported.where((option) => option.enabled).toList(growable: false);

  static List<Locale> get supportedLocales =>
      enabled.map((option) => option.locale).toList(growable: false);

  static const frameworkLocalizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    TheEyeMaterialLocalizationsDelegate(),
    TheEyeCupertinoLocalizationsDelegate(),
    TheEyeWidgetsLocalizationsDelegate(),
  ];

  static String? normalizeCode(String? value) {
    final normalized = value?.trim().toLowerCase();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }

  static TheEyeLocaleOption? optionForCode(String? code) {
    final normalized = normalizeCode(code);
    if (normalized == null) return null;
    for (final option in supported) {
      if (option.code == normalized) return option;
    }
    return null;
  }

  static bool isEnabledCode(String? code) =>
      optionForCode(code)?.enabled == true;

  static Locale effectiveLocaleForCode(String? code) {
    final option = optionForCode(code);
    return option != null && option.enabled ? option.locale : defaultLocale;
  }

  static Locale resolvePreferredLocale({
    String? serverLocale,
    String? cachedLocale,
    Iterable<Locale> deviceLocales = const [],
  }) {
    final server = optionForCode(serverLocale);
    if (server != null && server.enabled) return server.locale;

    final cached = optionForCode(cachedLocale);
    if (cached != null && cached.enabled) return cached.locale;

    for (final locale in deviceLocales) {
      final match = optionForCode(locale.languageCode);
      if (match != null && match.enabled) return match.locale;
    }

    return defaultLocale;
  }
}

class TheEyeMaterialLocalizationsDelegate
    extends LocalizationsDelegate<MaterialLocalizations> {
  const TheEyeMaterialLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      TheEyeLocaleCatalog.isEnabledCode(locale.languageCode);

  @override
  Future<MaterialLocalizations> load(Locale locale) =>
      SynchronousFuture<MaterialLocalizations>(
        const DefaultMaterialLocalizations(),
      );

  @override
  bool shouldReload(TheEyeMaterialLocalizationsDelegate old) => false;
}

class TheEyeCupertinoLocalizationsDelegate
    extends LocalizationsDelegate<CupertinoLocalizations> {
  const TheEyeCupertinoLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      TheEyeLocaleCatalog.isEnabledCode(locale.languageCode);

  @override
  Future<CupertinoLocalizations> load(Locale locale) =>
      SynchronousFuture<CupertinoLocalizations>(
        const DefaultCupertinoLocalizations(),
      );

  @override
  bool shouldReload(TheEyeCupertinoLocalizationsDelegate old) => false;
}

class TheEyeWidgetsLocalizationsDelegate
    extends LocalizationsDelegate<WidgetsLocalizations> {
  const TheEyeWidgetsLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      TheEyeLocaleCatalog.isEnabledCode(locale.languageCode);

  @override
  Future<WidgetsLocalizations> load(Locale locale) =>
      SynchronousFuture<WidgetsLocalizations>(
        const DefaultWidgetsLocalizations(),
      );

  @override
  bool shouldReload(TheEyeWidgetsLocalizationsDelegate old) => false;
}

class TheEyeLocaleController extends ChangeNotifier {
  TheEyeLocaleController(
      {Locale initialLocale = TheEyeLocaleCatalog.defaultLocale})
      : _locale = initialLocale;

  Locale _locale;

  Locale get locale => _locale;

  void setLocaleCode(String? code) {
    setLocale(TheEyeLocaleCatalog.effectiveLocaleForCode(code));
  }

  void setLocale(Locale locale) {
    final effective = TheEyeLocaleCatalog.effectiveLocaleForCode(
      locale.languageCode,
    );
    if (_locale == effective) return;
    _locale = effective;
    notifyListeners();
  }

  void resolve({
    String? serverLocale,
    String? cachedLocale,
    Iterable<Locale> deviceLocales = const [],
  }) {
    setLocale(
      TheEyeLocaleCatalog.resolvePreferredLocale(
        serverLocale: serverLocale,
        cachedLocale: cachedLocale,
        deviceLocales: deviceLocales,
      ),
    );
  }
}
