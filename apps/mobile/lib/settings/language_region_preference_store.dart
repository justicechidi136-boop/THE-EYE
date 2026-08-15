import "package:shared_preferences/shared_preferences.dart";

import "../contracts/the_eye_api_client.dart";
import "language_region_registry.dart";

class LanguageRegionPreferenceStore {
  LanguageRegionPreferenceStore(this._preferences);

  static const preferredLocaleKey = "the_eye_preferred_locale";
  static const countryCodeKey = "the_eye_country_code";

  final SharedPreferences _preferences;

  static Future<LanguageRegionPreferenceStore> create() async {
    return LanguageRegionPreferenceStore(await SharedPreferences.getInstance());
  }

  String? get preferredLocale => _preferences.getString(preferredLocaleKey);
  String? get countryCode => _preferences.getString(countryCodeKey);

  Future<void> save({
    String? preferredLocale,
    String? countryCode,
  }) async {
    final language =
        LanguageRegionRegistry.languageByLocale(preferredLocale)?.locale;
    final country = LanguageRegionRegistry.countryByCode(countryCode)?.code;
    if (language != null) {
      await _preferences.setString(preferredLocaleKey, language);
    }
    if (country != null) {
      await _preferences.setString(countryCodeKey, country);
    }
  }

  Future<void> saveFromProfile(CitizenProfile profile) async {
    await save(
      preferredLocale:
          profile.effectivePreferredLocale ?? profile.profile.preferredLocale,
      countryCode: profile.profile.countryCode,
    );
  }

  Future<void> clear() async {
    await _preferences.remove(preferredLocaleKey);
    await _preferences.remove(countryCodeKey);
  }
}
