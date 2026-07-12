import "package:shared_preferences/shared_preferences.dart";

import "car_profile.dart";

abstract class CarProfileStore {
  Future<CarProfile?> load();
  Future<void> save(CarProfile profile);
  Future<void> clear();
}

class SharedPreferencesCarProfileStore implements CarProfileStore {
  SharedPreferencesCarProfileStore(this._preferences);

  static const storageKey = "the_eye_car_profile";

  final SharedPreferences _preferences;

  static Future<SharedPreferencesCarProfileStore> create() async {
    return SharedPreferencesCarProfileStore(
        await SharedPreferences.getInstance());
  }

  @override
  Future<CarProfile?> load() async {
    return CarProfile.fromStorageJson(_preferences.getString(storageKey));
  }

  @override
  Future<void> save(CarProfile profile) async {
    await _preferences.setString(storageKey, profile.toStorageJson());
  }

  @override
  Future<void> clear() async {
    await _preferences.remove(storageKey);
  }
}

class InMemoryCarProfileStore implements CarProfileStore {
  CarProfile? profile;

  @override
  Future<CarProfile?> load() async => profile;

  @override
  Future<void> save(CarProfile value) async {
    profile = value;
  }

  @override
  Future<void> clear() async {
    profile = null;
  }
}
