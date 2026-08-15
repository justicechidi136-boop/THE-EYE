import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_field_ops/l10n/field_locale_store.dart";
import "package:the_eye_field_ops/l10n/generated/field_localizations.dart";
import "package:the_eye_field_ops/security/secure_session_store.dart";
import "package:the_eye_flutter_l10n/the_eye_locales.dart";

Widget _localizedWidget(Locale locale) {
  return MaterialApp(
    locale: locale,
    supportedLocales: TheEyeLocaleCatalog.supportedLocales,
    localizationsDelegates: const [
      FieldLocalizations.delegate,
      ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
    ],
    home: Builder(
      builder: (context) => Text(FieldLocalizations.of(context).dashboard),
    ),
  );
}

void main() {
  test("field session locale hydration falls back to English", () async {
    final session = SecureSessionStore(memory: {});
    final store = FieldLocaleStore(session);

    expect(await store.load(), const Locale("en"));
  });

  test("field session effective locale hydrates when saved", () async {
    final memory = <String, String>{};
    final session = SecureSessionStore(memory: memory);
    await session.saveSession(
      accessToken: "access",
      refreshToken: "refresh",
      sessionId: "session",
      publicDeviceId: "device",
      preferredLocale: "ig",
    );

    expect(await FieldLocaleStore(session).load(), const Locale("ig"));
  });

  testWidgets("field pilot labels localize", (tester) async {
    await tester.pumpWidget(_localizedWidget(const Locale("ha")));
    await tester.pumpAndSettle();

    expect(find.text("Allon aiki"), findsOneWidget);
  });
}
