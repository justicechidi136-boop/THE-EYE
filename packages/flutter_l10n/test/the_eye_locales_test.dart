import "dart:ui";

import "package:flutter_test/flutter_test.dart";
import "package:the_eye_flutter_l10n/the_eye_locales.dart";

void main() {
  test("supported locale codes resolve", () {
    expect(
        TheEyeLocaleCatalog.effectiveLocaleForCode("en"), const Locale("en"));
    expect(
        TheEyeLocaleCatalog.effectiveLocaleForCode("ha"), const Locale("ha"));
    expect(
        TheEyeLocaleCatalog.effectiveLocaleForCode("yo"), const Locale("yo"));
    expect(
        TheEyeLocaleCatalog.effectiveLocaleForCode("ig"), const Locale("ig"));
    expect(
      TheEyeLocaleCatalog.effectiveLocaleForCode("pcm"),
      const Locale("pcm"),
    );
  });

  test("unsupported locale falls back to English", () {
    expect(
        TheEyeLocaleCatalog.effectiveLocaleForCode("fr"), const Locale("en"));
    expect(
        TheEyeLocaleCatalog.effectiveLocaleForCode(null), const Locale("en"));
  });

  test("saved preference beats supported device locale", () {
    final locale = TheEyeLocaleCatalog.resolvePreferredLocale(
      cachedLocale: "ha",
      deviceLocales: const [Locale("yo")],
    );

    expect(locale, const Locale("ha"));
  });

  test("server preference beats local cached preference", () {
    final locale = TheEyeLocaleCatalog.resolvePreferredLocale(
      serverLocale: "ig",
      cachedLocale: "ha",
      deviceLocales: const [Locale("yo")],
    );

    expect(locale, const Locale("ig"));
  });

  test("supported device locale is used when no saved preference exists", () {
    final locale = TheEyeLocaleCatalog.resolvePreferredLocale(
      deviceLocales: const [Locale("yo")],
    );

    expect(locale, const Locale("yo"));
  });
}
