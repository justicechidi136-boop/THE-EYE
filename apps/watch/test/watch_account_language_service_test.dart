import 'dart:convert';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:the_eye_watch/api/watch_api_client.dart';
import 'package:the_eye_watch/services/watch_account_language_service.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  WatchApiClient client(MockClient mock) => WatchApiClient(
        httpClient: mock,
        baseUrl: 'https://staging-api.theeye.com.ng/v1',
        skipEnvGuard: true,
      );

  test('account preferredLocale overrides cached and device locale', () async {
    final preferences = PreferencesStore(
      preferences: await SharedPreferences.getInstance(),
    );
    await preferences.savePreferredUiLocale('yo');
    final credentials = SecureCredentialStore(memory: {});
    await credentials.saveAccessToken('token');
    final service = WatchAccountLanguageService(
      api: client(MockClient((request) async {
        expect(request.url.path, '/v1/users/me');
        return http.Response(
          jsonEncode({
            'profile': {'preferredLocale': 'ha'},
          }),
          200,
        );
      })),
      credentials: credentials,
      preferences: preferences,
    );

    await service.hydrate(deviceLocales: const [Locale('ig')]);

    expect(service.locale.value, const Locale('ha'));
    expect(await preferences.readPreferredUiLocale(), 'ha');
  });

  test('cached locale is used offline and unsupported server locale falls back',
      () async {
    final preferences = PreferencesStore(
      preferences: await SharedPreferences.getInstance(),
    );
    await preferences.savePreferredUiLocale('ig');
    final credentials = SecureCredentialStore(memory: {});
    await credentials.saveAccessToken('token');
    final service = WatchAccountLanguageService(
      api: client(MockClient((request) async {
        throw Exception('offline');
      })),
      credentials: credentials,
      preferences: preferences,
    );

    await service.hydrate(deviceLocales: const [Locale('ha')]);

    expect(service.locale.value, const Locale('ig'));
  });

  test('language selection updates immediately and patches account', () async {
    final preferences = PreferencesStore(
      preferences: await SharedPreferences.getInstance(),
    );
    final credentials = SecureCredentialStore(memory: {});
    await credentials.saveAccessToken('token');
    var patchedLocale = '';
    final service = WatchAccountLanguageService(
      api: client(MockClient((request) async {
        expect(request.method, 'PATCH');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        patchedLocale = body['preferredLocale'] as String;
        return http.Response(
            jsonEncode({'preferredLocale': patchedLocale}), 200);
      })),
      credentials: credentials,
      preferences: preferences,
    );

    await service.selectLocale('pcm');

    expect(service.locale.value, const Locale('pcm'));
    expect(await preferences.readPreferredUiLocale(), 'pcm');
    expect(patchedLocale, 'pcm');
  });
}
