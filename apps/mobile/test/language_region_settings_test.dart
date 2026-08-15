import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:the_eye_mobile/app/app_scope.dart";
import "package:the_eye_mobile/app/session_accessor.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/profile/profile_screen.dart";
import "package:the_eye_mobile/settings/language_region_preference_store.dart";
import "package:the_eye_mobile/settings/language_region_registry.dart";
import "package:the_eye_mobile/settings/language_region_settings_screen.dart";

class _FakeSession extends ChangeNotifier implements SessionAccessor {
  _FakeSession(this.profile);

  CitizenProfile? profile;
  Map<String, Object?>? lastPayload;
  Object? updateError;

  @override
  bool get isAuthenticated => true;

  @override
  String? get accessToken => "token";

  @override
  bool get lowDataMode => false;

  @override
  bool get online => true;

  @override
  CitizenProfile? get cachedCitizenProfile => profile;

  @override
  bool get isEmergencyLocationTracking => false;

  @override
  Future<void> clearSession() async {}

  @override
  Future<CitizenProfile?> loadCitizenProfile(
      {bool forceRefresh = false}) async {
    return profile;
  }

  @override
  void clearCitizenProfileCache() {}

  @override
  Future<CitizenProfile> updateCitizenProfile(
    Map<String, Object?> payload,
  ) async {
    lastPayload = payload;
    final error = updateError;
    if (error != null) throw error;
    final current = profile ?? _profile(profileComplete: false);
    profile = CitizenProfile.fromJson({
      "id": current.id,
      "displayName": current.displayName,
      "kycStatus": current.kycStatus,
      "profileComplete": true,
      "preferredLocale":
          payload["preferredLocale"] ?? current.preferredLocale ?? "en",
      "effectivePreferredLocale": payload["preferredLocale"] ??
          current.effectivePreferredLocale ??
          "en",
      "profile": {
        "firstName": payload["firstName"] ?? current.profile.firstName,
        "lastName": payload["lastName"] ?? current.profile.lastName,
        "country": payload["country"] ?? current.profile.country,
        "countryCode": payload["countryCode"] ?? current.profile.countryCode,
        "preferredLocale":
            payload["preferredLocale"] ?? current.profile.preferredLocale,
        "effectivePreferredLocale": payload["preferredLocale"] ??
            current.profile.effectivePreferredLocale,
        "state": payload["state"] ?? current.profile.state,
        "lga": payload["lga"] ?? current.profile.lga,
      },
    });
    notifyListeners();
    return profile!;
  }
}

CitizenProfile _profile({
  bool profileComplete = true,
  String? countryCode = "NG",
  String? preferredLocale = "en",
}) {
  return CitizenProfile.fromJson({
    "id": "user-1",
    "displayName": "Ada Okeke",
    "kycStatus": "Unverified",
    "profileComplete": profileComplete,
    "preferredLocale": preferredLocale,
    "effectivePreferredLocale": preferredLocale ?? "en",
    "profile": {
      "firstName": profileComplete ? "Ada" : "",
      "lastName": profileComplete ? "Okeke" : "",
      "country": countryCode == "NG" ? "Nigeria" : null,
      "countryCode": countryCode,
      "preferredLocale": preferredLocale,
      "effectivePreferredLocale": preferredLocale ?? "en",
      "state": profileComplete ? "Lagos" : "",
      "lga": profileComplete ? "Ikeja" : "",
    },
  });
}

Widget _app(SessionAccessor session, Widget child) {
  return MaterialApp(
    home: AppScope(
      controller: session,
      child: child,
    ),
    routes: {
      "/home": (_) => const Scaffold(body: Text("Home")),
    },
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test("registry exposes enabled country and language codes", () {
    expect(LanguageRegionRegistry.enabledCountries.map((c) => c.code), ["NG"]);
    expect(
      LanguageRegionRegistry.enabledLanguages.map((l) => l.locale),
      ["en", "ha", "yo", "ig", "pcm"],
    );
    expect(LanguageRegionRegistry.countryByCode("ng")?.displayName, "Nigeria");
  });

  test("device locale suggestion and fallback stay independent of country", () {
    expect(
      LanguageRegionRegistry.suggestedLanguage(
        deviceLocales: const [Locale("ha")],
        countryCode: "NG",
      ).locale,
      "ha",
    );
    expect(
      LanguageRegionRegistry.suggestedLanguage(
        deviceLocales: const [Locale("fr")],
        countryCode: "NG",
      ).locale,
      "en",
    );
    expect(
      LanguageRegionRegistry.suggestedLanguage(
        deviceLocales: const [Locale("yo")],
        countryCode: "NG",
        serverLocale: "pcm",
      ).locale,
      "pcm",
    );
  });

  testWidgets("profile completion submits canonical country and language codes",
      (tester) async {
    final session = _FakeSession(_profile(
      profileComplete: false,
      countryCode: null,
      preferredLocale: null,
    ));
    await tester.pumpWidget(
      _app(session, const Scaffold(body: ProfileScreenBody())),
    );
    await tester.pumpAndSettle();

    expect(find.text("Country / Region"), findsWidgets);
    expect(find.text("Preferred Language"), findsWidgets);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), "Ada");
    await tester.enterText(fields.at(1), "Okeke");
    await tester.enterText(fields.at(2), "Lagos");
    await tester.enterText(fields.at(3), "Ikeja");
    await tester.drag(find.byType(ListView), const Offset(0, -320));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton).last);
    await tester.pumpAndSettle();

    expect(session.lastPayload?["country"], "Nigeria");
    expect(session.lastPayload?["countryCode"], "NG");
    expect(session.lastPayload?["preferredLocale"], "en");
  });

  testWidgets("settings changes preferred language and updates cache",
      (tester) async {
    final session = _FakeSession(_profile(preferredLocale: "en"));
    await tester
        .pumpWidget(_app(session, const LanguageRegionSettingsScreen()));
    await tester.pumpAndSettle();

    expect(find.text("Nigeria"), findsOneWidget);
    expect(find.text("English"), findsOneWidget);

    await tester.tap(find.text("English"));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, "Hausa");
    await tester.pumpAndSettle();
    await tester.tap(find.text("Hausa").last);
    await tester.pumpAndSettle();

    expect(session.lastPayload?["preferredLocale"], "ha");
    final store = await LanguageRegionPreferenceStore.create();
    expect(store.preferredLocale, "ha");
  });

  testWidgets("settings preserves prior language when save fails",
      (tester) async {
    final session = _FakeSession(_profile(preferredLocale: "ha"))
      ..updateError = AuthApiException(500, "Unable to save");
    await tester
        .pumpWidget(_app(session, const LanguageRegionSettingsScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Hausa"));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, "Yoruba");
    await tester.pumpAndSettle();
    await tester.tap(find.text("Yoruba").last);
    await tester.pumpAndSettle();

    expect(session.lastPayload?["preferredLocale"], "yo");
    expect(find.text("Hausa"), findsOneWidget);
    expect(find.text("Unable to save"), findsOneWidget);
  });
}
