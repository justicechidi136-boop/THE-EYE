import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:the_eye_watch/api/watch_api_client.dart';
import 'package:the_eye_watch/models/offline_event.dart';
import 'package:the_eye_watch/services/connectivity_service.dart';
import 'package:the_eye_watch/services/location_service.dart';
import 'package:the_eye_watch/services/sos_service.dart';
import 'package:the_eye_watch/services/vibration_service.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

import 'sos_service_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('duplicate idempotency keys are not enqueued twice', () async {
    final preferences = InMemoryPreferencesStore();
    final connectivity = ConnectivityService(internetAvailable: false);
    final credentials = SecureCredentialStore(memory: {});
    await credentials.saveDeviceCredentials(
      deviceId: 'watch-1',
      deviceSecret: 'secret',
    );
    final api = WatchApiClient(
      httpClient: MockClient((_) async => http.Response('{}', 200)),
      baseUrl: 'http://test/v1',
    );
    final sos = SosService(
      api: api,
      credentials: credentials,
      preferences: preferences,
      connectivity: connectivity,
      location: LocationService(
        api: api,
        credentials: credentials,
        connectivity: connectivity,
        positionProvider: () async => null,
      ),
      vibration: VibrationService(),
      idGenerator: () => 'fixed-idempotency-key',
      holdDurationMs: 100,
      tickIntervalMs: 20,
    );

    await sos.submitSos();
    await sos.submitSos();
    final queue = await preferences.loadOfflineQueue();
    expect(queue, hasLength(1));
    expect(queue.first.idempotencyKey, 'fixed-idempotency-key');
    expect(queue.first.type, OfflineEventType.sos);
  });
}
