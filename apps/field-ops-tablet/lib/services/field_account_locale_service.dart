import 'dart:ui';

import 'package:the_eye_flutter_l10n/the_eye_locales.dart';

import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';
import '../l10n/field_locale_store.dart';

class FieldLocaleSelectionResult {
  const FieldLocaleSelectionResult({
    required this.locale,
    required this.synced,
    this.warning,
  });

  final Locale locale;
  final bool synced;
  final String? warning;
}

class FieldAccountLocaleService {
  FieldAccountLocaleService({
    required FieldApiClient api,
    required FieldLocaleStore store,
    TheEyeLocaleController? controller,
  }) : _api = api,
       _store = store,
       controller = controller ?? TheEyeLocaleController();

  final FieldApiClient _api;
  final FieldLocaleStore _store;
  final TheEyeLocaleController controller;
  Iterable<Locale> _deviceLocales = const [];

  Locale get locale => controller.locale;

  Future<void> hydrate({Iterable<Locale> deviceLocales = const []}) async {
    _deviceLocales = List<Locale>.from(deviceLocales);
    final cached = await _store.cachedLocaleCode();
    controller.resolve(cachedLocale: cached, deviceLocales: _deviceLocales);
    await syncFromAccount();
  }

  Future<void> syncFromAccount() async {
    try {
      final response = await _api.get(FieldApiPaths.adminPreferences);
      final code = _extractLocaleCode(response);
      if (code == null) return;
      await applyServerLocale(code);
    } on FieldApiException {
      // Cached/device locale remains active while the tablet is offline or the
      // officer session is not ready yet.
    }
  }

  Future<void> applyServerLocale(String? preferredLocale) async {
    final option = TheEyeLocaleCatalog.optionForCode(preferredLocale);
    if (option == null || !option.enabled) return;
    await _store.saveLocaleCode(option.code);
    controller.setLocale(option.locale);
  }

  Future<FieldLocaleSelectionResult> selectLocale(String code) async {
    final option = TheEyeLocaleCatalog.optionForCode(code);
    if (option == null || !option.enabled) {
      throw ArgumentError.value(code, 'code', 'Unsupported locale');
    }

    await _store.saveLocaleCode(option.code);
    controller.setLocale(option.locale);

    try {
      final response = await _api.patch(
        FieldApiPaths.adminPreferences,
        body: {'preferredLocale': option.code},
      );
      final serverCode = _extractLocaleCode(response);
      if (serverCode != null) {
        await applyServerLocale(serverCode);
      }
      return FieldLocaleSelectionResult(
        locale: controller.locale,
        synced: true,
      );
    } on FieldApiException catch (error) {
      return FieldLocaleSelectionResult(
        locale: controller.locale,
        synced: false,
        warning: error.message,
      );
    }
  }

  Future<void> resetAfterLogout() async {
    await _store.clearLocaleCode();
    controller.resolve(deviceLocales: _deviceLocales);
  }

  String? _extractLocaleCode(Map<String, dynamic> response) {
    final data = Map<String, dynamic>.from(
      response['data'] as Map? ?? response,
    );
    return data['effectivePreferredLocale']?.toString() ??
        data['preferredLocale']?.toString();
  }

  void dispose() => controller.dispose();
}
