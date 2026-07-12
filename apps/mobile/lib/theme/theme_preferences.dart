import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";

enum ThemePreference { dark, light, system }

class ThemePreferences {
  ThemePreferences(this._prefs);

  static const storageKey = "the_eye_theme_preference";
  final SharedPreferences _prefs;

  static Future<ThemePreferences> load() async {
    return ThemePreferences(await SharedPreferences.getInstance());
  }

  ThemePreference get preference {
    final raw = _prefs.getString(storageKey);
    switch (raw) {
      case "light":
        return ThemePreference.light;
      case "system":
        return ThemePreference.system;
      default:
        return ThemePreference.dark;
    }
  }

  Future<void> setPreference(ThemePreference preference) {
    final value = switch (preference) {
      ThemePreference.dark => "dark",
      ThemePreference.light => "light",
      ThemePreference.system => "system",
    };
    return _prefs.setString(storageKey, value);
  }

  ThemeMode resolveThemeMode() {
    return switch (preference) {
      ThemePreference.dark => ThemeMode.dark,
      ThemePreference.light => ThemeMode.light,
      ThemePreference.system => ThemeMode.system,
    };
  }
}
