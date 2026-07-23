import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/models/offline_event.dart';
import 'package:the_eye_watch/storage/encrypted_offline_queue_store.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

class MemoryEncryptedQueueStore extends EncryptedOfflineQueueStore {
  MemoryEncryptedQueueStore({PreferencesStore? legacy})
      : super(memory: {}, legacyPreferences: legacy);
}

void main() {
  test('encrypted queue round-trips SOS payload', () async {
    final store = MemoryEncryptedQueueStore();
    final event = OfflineEvent(
      id: 'evt-1',
      type: OfflineEventType.sos,
      payload: {'deviceId': 'watch-1', 'latitude': 6.5, 'silent': true},
      occurredAt: DateTime.utc(2026, 7, 11, 12),
      idempotencyKey: 'key-abc',
    );
    await store.saveQueue([event]);
    final restored = await store.loadQueue();
    expect(restored, hasLength(1));
    expect(restored.first.idempotencyKey, 'key-abc');
    expect(restored.first.payload['latitude'], 6.5);
  });

  test('encrypted queue migrates legacy plaintext queue', () async {
    final legacy = InMemoryPreferencesStore();
    await legacy.saveOfflineQueue([
      OfflineEvent(
        id: 'legacy-1',
        type: OfflineEventType.sos,
        payload: {'deviceId': 'watch-legacy'},
        occurredAt: DateTime.utc(2026, 7, 11, 10),
      ),
    ]);
    final store = MemoryEncryptedQueueStore(legacy: legacy);
    final migrated = await store.loadQueue();
    expect(migrated, hasLength(1));
    expect(migrated.first.id, 'legacy-1');
    expect(await legacy.loadOfflineQueue(), isEmpty);
  });

  test('encrypted queue clears on unpair wipe', () async {
    final store = MemoryEncryptedQueueStore();
    await store.saveQueue([
      OfflineEvent(
        id: 'evt-2',
        type: OfflineEventType.sos,
        payload: const {'deviceId': 'x'},
        occurredAt: DateTime.now(),
      ),
    ]);
    await store.clear();
    expect(await store.loadQueue(), isEmpty);
  });
}

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
