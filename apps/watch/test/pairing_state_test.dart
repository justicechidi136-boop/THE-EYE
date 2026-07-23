import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/api/watch_api_client.dart';
import 'package:the_eye_watch/models/pairing_state.dart';
import 'package:the_eye_watch/pairing/pairing_service.dart';
import 'package:the_eye_watch/services/push_message_router.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

class FakePreferencesStore extends PreferencesStore {
  FakePreferencesStore() : _paired = false;

  bool _paired;
  String? _code;

  @override
  Future<bool> isPaired() async => _paired;

  @override
  Future<void> setPaired(bool value) async => _paired = value;

  @override
  Future<void> savePairingCode(String? code) async => _code = code;

  @override
  Future<String?> readPairingCode() async => _code;
}

class FakeWatchApiClient extends WatchApiClient {
  FakeWatchApiClient()
      : super(httpClient: null, baseUrl: 'http://test/v1', skipEnvGuard: true);

  final List<Map<String, dynamic>> posts = [];

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    posts.add({'path': path, 'body': body ?? {}});
    return {
      'data': {'status': 'pending'}
    };
  }

  @override
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
    Map<String, String>? headers,
  }) async {
    return {
      'data': {'status': 'pending'}
    };
  }

  @override
  void dispose() {}
}

void main() {
  test('pairing state machine transitions to paired', () async {
    final credentials = SecureCredentialStore(memory: {});
    final preferences = FakePreferencesStore();
    final api = FakeWatchApiClient();
    final service = PairingService(
      api: api,
      credentials: credentials,
      preferences: preferences,
    );

    final started = await service.beginPairing();
    expect(started.phase, PairingPhase.awaitingPhoneConfirmation);
    expect(started.pairingCode, isNotEmpty);
    expect(api.posts.single['path'], '/smartwatch/devices/pairing-codes');

    final paired = await service.completePairing(deviceSecret: 'secret-123');
    expect(paired.phase, PairingPhase.paired);
    expect(paired.pairedAt, isNotNull);
    expect(await credentials.readDeviceSecret(), 'secret-123');
    expect(await preferences.isPaired(), isTrue);
  });

  test('pairing failure stores error message', () async {
    final service = PairingService(
      api: FakeWatchApiClient(),
      credentials: SecureCredentialStore(memory: {}),
      preferences: FakePreferencesStore(),
    );

    final failed = await service.markFailed('Phone unreachable');
    expect(failed.phase, PairingPhase.failed);
    expect(failed.errorMessage, 'Phone unreachable');
  });

  test('watch push router accepts only watch categories', () {
    expect(PushMessageRouter.isWatchCategory('FamilySosAlert'), isTrue);
    expect(PushMessageRouter.isWatchCategory('NearbyDangerWarning'), isFalse);
  });
}
