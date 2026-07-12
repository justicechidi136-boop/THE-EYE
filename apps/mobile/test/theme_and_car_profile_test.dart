import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/profile/car_profile.dart";
import "package:the_eye_mobile/profile/car_profile_store.dart";
import "package:the_eye_mobile/theme/theme_preferences.dart";
import "package:the_eye_mobile/theme/theme_provider.dart";

void main() {
  group("ThemePreferences", () {
    test("defaults to dark when unset", () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await ThemePreferences.load();
      expect(prefs.preference, ThemePreference.dark);
      expect(prefs.resolveThemeMode(), ThemeMode.dark);
    });

    test("persists light and system choices", () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await ThemePreferences.load();
      await prefs.setPreference(ThemePreference.light);
      expect(prefs.preference, ThemePreference.light);

      final reloaded = await ThemePreferences.load();
      expect(reloaded.preference, ThemePreference.light);
      expect(reloaded.resolveThemeMode(), ThemeMode.light);

      await reloaded.setPreference(ThemePreference.system);
      final systemReloaded = await ThemePreferences.load();
      expect(systemReloaded.preference, ThemePreference.system);
      expect(systemReloaded.resolveThemeMode(), ThemeMode.system);
    });
  });

  group("ThemeProvider", () {
    test("notifies listeners when preference changes", () async {
      SharedPreferences.setMockInitialValues({});
      final provider = await ThemeProvider.load();
      var notifications = 0;
      provider.addListener(() => notifications++);

      await provider.setPreference(ThemePreference.light);
      expect(provider.preference, ThemePreference.light);
      expect(notifications, 1);

      await provider.setPreference(ThemePreference.light);
      expect(notifications, 1);
    });
  });

  group("CarProfileStore", () {
    test("round-trips saved car profile", () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferencesCarProfileStore.create();
      const profile = CarProfile(
        make: "Toyota",
        model: "Corolla",
        plateNumber: "LAG-123-EYE",
        year: 2019,
        color: "Silver",
        vin: "VIN123",
        notes: "Tinted windows",
        imagePath: "/tmp/car.jpg",
      );

      await store.save(profile);
      final loaded = await store.load();

      expect(loaded, isNotNull);
      expect(loaded!.make, "Toyota");
      expect(loaded.model, "Corolla");
      expect(loaded.plateNumber, "LAG-123-EYE");
      expect(loaded.year, 2019);
      expect(loaded.color, "Silver");
      expect(loaded.vin, "VIN123");
      expect(loaded.notes, "Tinted windows");
      expect(loaded.imagePath, "/tmp/car.jpg");
      expect(loaded.displayLabel, "2019 Toyota Corolla");
    });

    test("clear removes saved profile", () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferencesCarProfileStore.create();
      await store.save(const CarProfile(
        make: "Honda",
        model: "Civic",
        plateNumber: "ABC-123",
      ));
      await store.clear();
      expect(await store.load(), isNull);
    });
  });
}
