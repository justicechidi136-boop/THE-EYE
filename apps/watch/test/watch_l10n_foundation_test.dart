import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:the_eye_flutter_l10n/the_eye_locales.dart";
import "package:the_eye_watch/alerts/danger_alert_models.dart";
import "package:the_eye_watch/l10n/generated/watch_localizations.dart";
import "package:the_eye_watch/l10n/watch_locale_store.dart";
import "package:the_eye_watch/storage/secure_credential_store.dart";

Widget _localizedWidget(Locale locale) {
  return MaterialApp(
    locale: locale,
    supportedLocales: TheEyeLocaleCatalog.supportedLocales,
    localizationsDelegates: const [
      WatchLocalizations.delegate,
      ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
    ],
    home: Builder(
      builder: (context) => Text(WatchLocalizations.of(context).alerts),
    ),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test("watch locale store falls back and resolves supported locales",
      () async {
    final preferences = PreferencesStore(
      preferences: await SharedPreferences.getInstance(),
    );
    final store = WatchLocaleStore(preferences);

    expect(await store.load(), const Locale("en"));

    await store.save("yo");
    expect(await store.load(deviceLocales: const [Locale("ha")]),
        const Locale("yo"));
  });

  testWidgets("watch pilot labels localize", (tester) async {
    await tester.pumpWidget(_localizedWidget(const Locale("ha")));
    await tester.pumpAndSettle();

    expect(find.text("Fadakarwa"), findsOneWidget);
  });

  test("preferred spoken language remains a separate TTS concept", () {
    const preferences = WatchAccessibilityPreferences(
      preferredSpokenLanguage: SpokenLanguageCodes.hausa,
    );

    expect(preferences.preferredSpokenLanguage, SpokenLanguageCodes.hausa);
    expect(
        TheEyeLocaleCatalog.effectiveLocaleForCode("yo"), const Locale("yo"));
  });
}
