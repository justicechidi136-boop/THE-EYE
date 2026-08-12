import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/profile/car_profile.dart";
import "package:the_eye_mobile/profile/car_profile_store.dart";
import "package:the_eye_mobile/evidence/evidence_policy.dart";
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

  group("VehicleGarageStore", () {
    test("round-trips saved vehicle list with one entry", () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferencesVehicleGarageStore.create();
      const profile = CarProfile(
        id: "vehicle-1",
        make: "Toyota",
        model: "Corolla",
        plateNumber: "LAG-123-EYE",
        year: 2019,
        color: "Silver",
        vin: "VIN123",
        notes: "Tinted windows",
        imagePath: "/tmp/car.jpg",
        photos: [
          CarPhotoRef(
            id: "photo-1",
            objectKey: "vehicles/u1/v1/photo.jpg",
            contentType: "image/jpeg",
            sizeBytes: 1024,
            sortOrder: 0,
            previewUrl: "https://cdn.test/photo.jpg",
          ),
        ],
        isPrimary: true,
      );

      await store.saveVehicles(const [profile]);
      final loadedList = await store.loadVehicles();

      expect(loadedList, hasLength(1));
      final loaded = loadedList.first;
      expect(loaded.make, "Toyota");
      expect(loaded.model, "Corolla");
      expect(loaded.plateNumber, "LAG-123-EYE");
      expect(loaded.year, 2019);
      expect(loaded.color, "Silver");
      expect(loaded.vin, "VIN123");
      expect(loaded.notes, "Tinted windows");
      expect(loaded.imagePath, "/tmp/car.jpg");
      expect(loaded.photos, hasLength(1));
      expect(loaded.photos.first.objectKey, "vehicles/u1/v1/photo.jpg");
      expect(loaded.isPrimary, isTrue);
      expect(loaded.displayLabel, "2019 Toyota Corolla");
    });

    test("supports zero one two three vehicles", () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferencesVehicleGarageStore.create();
      await store.saveVehicles(const []);
      expect(await store.loadVehicles(), isEmpty);

      await store.saveVehicles(const [
        CarProfile(make: "Toyota", model: "Corolla", plateNumber: "ABC-111"),
      ]);
      expect(await store.loadVehicles(), hasLength(1));

      await store.saveVehicles(const [
        CarProfile(make: "Toyota", model: "Corolla", plateNumber: "ABC-111"),
        CarProfile(make: "Honda", model: "Civic", plateNumber: "ABC-222"),
      ]);
      expect(await store.loadVehicles(), hasLength(2));

      await store.saveVehicles(const [
        CarProfile(make: "Toyota", model: "Corolla", plateNumber: "ABC-111"),
        CarProfile(make: "Honda", model: "Civic", plateNumber: "ABC-222"),
        CarProfile(make: "Lexus", model: "RX", plateNumber: "ABC-333"),
      ]);
      expect(await store.loadVehicles(), hasLength(3));
    });

    test("migration preserves existing local single vehicle", () async {
      SharedPreferences.setMockInitialValues({
        SharedPreferencesVehicleGarageStore.legacyStorageKey: const CarProfile(
          make: "Honda",
          model: "Civic",
          plateNumber: "ABC-123",
          imagePath: "/tmp/legacy.jpg",
        ).toStorageJson(),
      });
      final store = await SharedPreferencesVehicleGarageStore.create();
      final legacy = await store.loadLegacyCarProfile();
      expect(legacy, isNotNull);
      expect(legacy!.plateNumber, "ABC-123");
      expect(legacy.imagePath, "/tmp/legacy.jpg");
    });

    test("clear removes saved garage and legacy profile", () async {
      SharedPreferences.setMockInitialValues({});
      final store = await SharedPreferencesVehicleGarageStore.create();
      await store.saveVehicles(const [
        CarProfile(
          make: "Honda",
          model: "Civic",
          plateNumber: "ABC-123",
        )
      ]);
      await store.clear();
      expect(await store.loadVehicles(), isEmpty);
      expect(await store.loadLegacyCarProfile(), isNull);
    });
  });

  test("vehicle photo evidence policy enforces max of eight", () {
    expect(EvidencePolicy.vehiclePhotos.maxPhotos, 8);
    expect(EvidencePolicy.vehiclePhotos.maxFileSize, 5 * 1024 * 1024);
    expect(
      EvidencePolicy.vehiclePhotos.supportedMimeTypes,
      containsAll(<String>["image/jpeg", "image/png", "image/webp"]),
    );
  });
}
