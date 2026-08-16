import 'dart:convert';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:the_eye_field_ops/api/field_api_client.dart';
import 'package:the_eye_field_ops/l10n/field_locale_store.dart';
import 'package:the_eye_field_ops/security/secure_session_store.dart';
import 'package:the_eye_field_ops/services/field_account_locale_service.dart';

FieldAccountLocaleService _service({
  required SecureSessionStore session,
  required MockClient client,
}) {
  return FieldAccountLocaleService(
    api: FieldApiClient(
      httpClient: client,
      baseUrl: 'https://api.example.test/v1',
      skipEnvGuard: true,
    ),
    store: FieldLocaleStore(session),
  );
}

http.Response _json(Map<String, dynamic> body, {int statusCode = 200}) =>
    http.Response(
      jsonEncode(body),
      statusCode,
      headers: {'content-type': 'application/json'},
    );

void main() {
  test(
    'GET preferences server locale wins over cached and device locale',
    () async {
      final session = SecureSessionStore(
        memory: {'field.preferred_locale': 'yo'},
      );
      final service = _service(
        session: session,
        client: MockClient(
          (_) async => _json({
            'data': {'preferredLocale': 'ha', 'effectivePreferredLocale': 'ha'},
          }),
        ),
      );

      await service.hydrate(deviceLocales: const [Locale('ig')]);

      expect(service.locale, const Locale('ha'));
      expect(await session.readPreferredLocale(), 'ha');
    },
  );

  test('cached locale is used offline', () async {
    final session = SecureSessionStore(
      memory: {'field.preferred_locale': 'ig'},
    );
    final service = _service(
      session: session,
      client: MockClient((_) async => throw http.ClientException('offline')),
    );

    await service.hydrate(deviceLocales: const [Locale('ha')]);

    expect(service.locale, const Locale('ig'));
  });

  test('supported device locale is used with no account or cache', () async {
    final service = _service(
      session: SecureSessionStore(memory: {}),
      client: MockClient((_) async => throw http.ClientException('offline')),
    );

    await service.hydrate(deviceLocales: const [Locale('yo')]);

    expect(service.locale, const Locale('yo'));
  });

  test(
    'English is used when account cache and device locale are unsupported',
    () async {
      final service = _service(
        session: SecureSessionStore(memory: {}),
        client: MockClient((_) async => throw http.ClientException('offline')),
      );

      await service.hydrate(deviceLocales: const [Locale('fr')]);

      expect(service.locale, const Locale('en'));
    },
  );

  test('unsupported server locale is rejected safely', () async {
    final session = SecureSessionStore(
      memory: {'field.preferred_locale': 'pcm'},
    );
    final service = _service(
      session: session,
      client: MockClient(
        (_) async => _json({
          'data': {'preferredLocale': 'fr', 'effectivePreferredLocale': 'fr'},
        }),
      ),
    );

    await service.hydrate();

    expect(service.locale, const Locale('pcm'));
  });

  test('login and refresh locale callbacks update UI immediately', () async {
    final session = SecureSessionStore(memory: {});
    final service = _service(
      session: session,
      client: MockClient((_) async => _json({'data': {}})),
    );

    await service.applyServerLocale('ha');
    expect(service.locale, const Locale('ha'));
    await service.applyServerLocale('yo');
    expect(service.locale, const Locale('yo'));
  });

  test(
    'language picker updates UI, persists selection, and PATCHes server',
    () async {
      String? patchedLocale;
      final session = SecureSessionStore(memory: {});
      final service = _service(
        session: session,
        client: MockClient((request) async {
          if (request.method == 'PATCH') {
            patchedLocale =
                jsonDecode(request.body)['preferredLocale'] as String;
            return _json({
              'data': {
                'preferredLocale': patchedLocale,
                'effectivePreferredLocale': patchedLocale,
              },
            });
          }
          return _json({'data': {}});
        }),
      );

      final result = await service.selectLocale('pcm');

      expect(result.synced, isTrue);
      expect(service.locale, const Locale('pcm'));
      expect(await session.readPreferredLocale(), 'pcm');
      expect(patchedLocale, 'pcm');
    },
  );

  test('PATCH failure keeps local selection without crashing', () async {
    final session = SecureSessionStore(memory: {});
    final service = _service(
      session: session,
      client: MockClient(
        (_) async => _json({'message': 'offline'}, statusCode: 503),
      ),
    );

    final result = await service.selectLocale('ig');

    expect(result.synced, isFalse);
    expect(service.locale, const Locale('ig'));
    expect(await session.readPreferredLocale(), 'ig');
  });

  test('selection persists across restart', () async {
    final session = SecureSessionStore(memory: {});
    final first = _service(
      session: session,
      client: MockClient((_) async => _json({'data': {}})),
    );
    await first.selectLocale('ha');

    final second = _service(
      session: session,
      client: MockClient((_) async => throw http.ClientException('offline')),
    );
    await second.hydrate();

    expect(second.locale, const Locale('ha'));
  });

  test(
    'logout clears account locale and falls back to device locale',
    () async {
      final session = SecureSessionStore(
        memory: {'field.preferred_locale': 'ha'},
      );
      final service = _service(
        session: session,
        client: MockClient((_) async => _json({'data': {}})),
      );
      await service.hydrate(deviceLocales: const [Locale('yo')]);

      await service.resetAfterLogout();

      expect(service.locale, const Locale('yo'));
      expect(await session.readPreferredLocale(), isNull);
    },
  );
}
