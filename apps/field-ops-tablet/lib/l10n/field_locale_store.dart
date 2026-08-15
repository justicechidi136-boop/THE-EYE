import "dart:ui";

import "package:the_eye_flutter_l10n/the_eye_locales.dart";

import "../security/secure_session_store.dart";

class FieldLocaleStore {
  const FieldLocaleStore(this._session);

  final SecureSessionStore _session;

  Future<Locale> load({Iterable<Locale> deviceLocales = const []}) async {
    final preferred = await _session.readPreferredLocale();
    return TheEyeLocaleCatalog.resolvePreferredLocale(
      serverLocale: preferred,
      deviceLocales: deviceLocales,
    );
  }
}
