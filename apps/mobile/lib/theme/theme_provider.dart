import "package:flutter/material.dart";

import "theme_preferences.dart";

/// Bridges persisted [ThemePreferences] with [ChangeNotifier] so bootstrap and
/// [MaterialApp] can react to appearance changes immediately.
class ThemeProvider extends ChangeNotifier {
  ThemeProvider(this._preferences);

  final ThemePreferences _preferences;

  ThemePreferences get preferences => _preferences;

  ThemePreference get preference => _preferences.preference;

  ThemeMode get themeMode => _preferences.resolveThemeMode();

  Future<void> setPreference(ThemePreference preference) async {
    if (this.preference == preference) return;
    await _preferences.setPreference(preference);
    notifyListeners();
  }

  static Future<ThemeProvider> load() async {
    return ThemeProvider(await ThemePreferences.load());
  }
}
