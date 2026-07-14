import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:the_eye_watch/api/watch_api_client.dart';
import 'package:the_eye_watch/models/offline_event.dart';
import 'package:the_eye_watch/models/sos_event.dart';
import 'package:the_eye_watch/services/connectivity_service.dart';
import 'package:the_eye_watch/services/location_service.dart';
import 'package:the_eye_watch/services/sos_service.dart';
import 'package:the_eye_watch/services/vibration_service.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

class InMemoryPreferencesStore extends PreferencesStore {
  InMemoryPreferencesStore() : _queue = [];

  List<OfflineEvent> _queue;

  @override
  Future<List<OfflineEvent>> loadOfflineQueue() async => List.from(_queue);

  @override
  Future<void> saveOfflineQueue(List<OfflineEvent> events) async {
    _queue = List.from(events);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('SOS hold can be cancelled before submission', () async {
    final sos = _buildSosService(
      MockClient((_) async => http.Response('{}', 500)),
    );

    sos.beginHold();
    expect(sos.state.lifecycle, SosLifecycle.holding);
    sos.cancelHold();
    expect(sos.state.lifecycle, SosLifecycle.cancelled);
  });

  test('SOS countdown cancel prevents submit', () async {
    final client = MockClient((_) async => http.Response(
          '{"data":{"id":"sos-1"},"incident":{"id":"inc-1"}}',
          200,
        ));
    final sos = _buildSosService(
      client,
      holdDurationMs: 100,
      tickIntervalMs: 50,
    );

    sos.beginHold();
    await Future<void>.delayed(const Duration(milliseconds: 250));
    expect(sos.state.lifecycle, SosLifecycle.countdown);
    sos.cancelHold();
    expect(sos.state.lifecycle, SosLifecycle.cancelled);
    await Future<void>.delayed(const Duration(seconds: 4));
    expect(sos.state.lifecycle, isNot(SosLifecycle.submitting));
    expect(sos.state.lifecycle, isNot(SosLifecycle.active));
  });

  test('offline SOS is queued when connectivity is offline', () async {
    final preferences = InMemoryPreferencesStore();
    final connectivity = ConnectivityService(internetAvailable: false);
    final sos = _buildSosService(
      MockClient((_) async => http.Response('{}', 200)),
      preferences: preferences,
      connectivity: connectivity,
      idGenerator: () => '11111111-1111-1111-1111-111111111111',
    );

    await sos.submitSos();
    final queue = await preferences.loadOfflineQueue();
    expect(queue, hasLength(1));
    expect(queue.first.type, OfflineEventType.sos);
    expect(queue.first.idempotencyKey, '11111111-1111-1111-1111-111111111111');
    expect(sos.state.lifecycle, SosLifecycle.failed);
    expect(sos.state.errorMessage, contains('Queued'));
  });
}

SosService _buildSosService(
  http.Client client, {
  PreferencesStore? preferences,
  ConnectivityService? connectivity,
  String Function()? idGenerator,
  int holdDurationMs = 300,
  int tickIntervalMs = 50,
}) {
  final credentials = SecureCredentialStore(memory: {});
  credentials.saveDeviceCredentials(
    deviceId: 'watch-test-1',
    deviceSecret: 'secret',
  );
  final api = WatchApiClient(httpClient: client, baseUrl: 'http://test/v1');
  final prefs = preferences ?? InMemoryPreferencesStore();
  final conn = connectivity ?? ConnectivityService(internetAvailable: true);
  var idCount = 0;
  return SosService(
    api: api,
    credentials: credentials,
    preferences: prefs,
    connectivity: conn,
    location: LocationService(
      api: api,
      credentials: credentials,
      connectivity: conn,
      positionProvider: () async => null,
    ),
    vibration: VibrationService(),
    idGenerator: idGenerator ??
        () {
          idCount += 1;
          return '00000000-0000-0000-0000-${idCount.toString().padLeft(12, '0')}';
        },
    holdDurationMs: holdDurationMs,
    tickIntervalMs: tickIntervalMs,
  );
}
