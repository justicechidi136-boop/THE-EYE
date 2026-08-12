import "package:shared_preferences/shared_preferences.dart";
import "dart:convert";

import "car_profile.dart";

abstract class VehicleGarageStore {
  Future<List<CarProfile>> loadVehicles();
  Future<void> saveVehicles(List<CarProfile> vehicles);
  Future<CarProfile?> loadLegacyCarProfile();
  Future<void> clearLegacyCarProfile();
  Future<void> clear();
}

class SharedPreferencesVehicleGarageStore implements VehicleGarageStore {
  SharedPreferencesVehicleGarageStore(this._preferences);

  static const storageKey = "the_eye_vehicle_garage_v1";
  static const legacyStorageKey = "the_eye_car_profile";

  final SharedPreferences _preferences;

  static Future<SharedPreferencesVehicleGarageStore> create() async {
    return SharedPreferencesVehicleGarageStore(
        await SharedPreferences.getInstance());
  }

  @override
  Future<List<CarProfile>> loadVehicles() async {
    final raw = _preferences.getString(storageKey);
    if (raw == null || raw.trim().isEmpty) return const [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map>()
        .map((item) => CarProfile.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  @override
  Future<void> saveVehicles(List<CarProfile> vehicles) async {
    final payload = vehicles.map((vehicle) => vehicle.toJson()).toList();
    await _preferences.setString(storageKey, jsonEncode(payload));
  }

  @override
  Future<CarProfile?> loadLegacyCarProfile() async {
    return CarProfile.fromStorageJson(_preferences.getString(legacyStorageKey));
  }

  @override
  Future<void> clearLegacyCarProfile() async {
    await _preferences.remove(legacyStorageKey);
  }

  @override
  Future<void> clear() async {
    await _preferences.remove(storageKey);
    await _preferences.remove(legacyStorageKey);
  }
}

class InMemoryVehicleGarageStore implements VehicleGarageStore {
  List<CarProfile> vehicles = const [];
  CarProfile? legacyProfile;

  @override
  Future<List<CarProfile>> loadVehicles() async => vehicles;

  @override
  Future<void> saveVehicles(List<CarProfile> value) async =>
      vehicles = List<CarProfile>.from(value);

  @override
  Future<CarProfile?> loadLegacyCarProfile() async => legacyProfile;

  @override
  Future<void> clearLegacyCarProfile() async {
    legacyProfile = null;
  }

  @override
  Future<void> clear() async {
    vehicles = const [];
    legacyProfile = null;
  }
}
