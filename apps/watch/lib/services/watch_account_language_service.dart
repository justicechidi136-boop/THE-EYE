import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:the_eye_flutter_l10n/the_eye_locales.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../l10n/watch_locale_store.dart';
import '../storage/secure_credential_store.dart';

class WatchAccountLanguageService {
  WatchAccountLanguageService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
  })  : _api = api,
        _credentials = credentials,
        _store = WatchLocaleStore(preferences);

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final WatchLocaleStore _store;

  final ValueNotifier<Locale> locale =
      ValueNotifier<Locale>(TheEyeLocaleCatalog.defaultLocale);
  bool _disposed = false;

  Future<void> hydrate({
    Iterable<Locale> deviceLocales = const [],
  }) async {
    locale.value = await _store.load(deviceLocales: deviceLocales);
    await syncFromAccount(deviceLocales: deviceLocales);
  }

  Future<void> syncFromAccount({
    Iterable<Locale> deviceLocales = const [],
  }) async {
    final accessToken = await _credentials.readAccessToken();
    if (accessToken == null || accessToken.isEmpty) return;

    _api.accessToken = accessToken;
    try {
      final response = await _api.get(WatchApiPaths.usersMe);
      final serverLocale = _extractPreferredLocale(response);
      final resolved = TheEyeLocaleCatalog.resolvePreferredLocale(
        serverLocale: serverLocale,
        cachedLocale: await _store.cachedLocaleCode(),
        deviceLocales: deviceLocales,
      );
      await _store.save(resolved.languageCode);
      locale.value = resolved;
    } catch (_) {
      locale.value = await _store.load(deviceLocales: deviceLocales);
    }
  }

  Future<void> selectLocale(String localeCode) async {
    if (!TheEyeLocaleCatalog.isEnabledCode(localeCode)) return;
    final resolved = TheEyeLocaleCatalog.effectiveLocaleForCode(localeCode);
    locale.value = resolved;
    await _store.save(resolved.languageCode);

    final accessToken = await _credentials.readAccessToken();
    if (accessToken == null || accessToken.isEmpty) return;

    _api.accessToken = accessToken;
    try {
      await _api.patch(
        WatchApiPaths.usersMe,
        body: {'preferredLocale': resolved.languageCode},
      );
    } catch (_) {
      // Keep local preference; the next account sync can reconcile it.
    }
  }

  String? _extractPreferredLocale(Map<String, dynamic> response) {
    final direct = response['effectivePreferredLocale']?.toString() ??
        response['preferredLocale']?.toString();
    if (direct != null && direct.isNotEmpty) return direct;

    final profile = response['profile'];
    if (profile is Map<String, dynamic>) {
      return profile['effectivePreferredLocale']?.toString() ??
          profile['preferredLocale']?.toString();
    }
    return null;
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    locale.dispose();
  }
}
