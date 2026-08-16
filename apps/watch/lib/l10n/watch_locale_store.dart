import "dart:ui";

import "package:the_eye_flutter_l10n/the_eye_locales.dart";

import "../storage/secure_credential_store.dart";

class WatchLocaleStore {
  const WatchLocaleStore(this._preferences);

  final PreferencesStore _preferences;

  Future<String?> cachedLocaleCode() => _preferences.readPreferredUiLocale();

  Future<Locale> load({
    Iterable<Locale> deviceLocales = const [],
  }) async {
    final cached = await _preferences.readPreferredUiLocale();
    return TheEyeLocaleCatalog.resolvePreferredLocale(
      cachedLocale: cached,
      deviceLocales: deviceLocales,
    );
  }

  Future<void> save(String localeCode) async {
    if (!TheEyeLocaleCatalog.isEnabledCode(localeCode)) return;
    await _preferences.savePreferredUiLocale(localeCode);
  }
}
