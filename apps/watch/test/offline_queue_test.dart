import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/models/offline_event.dart';

void main() {
  test('offline event round-trips through storage json', () {
    final event = OfflineEvent(
      id: 'evt-1',
      type: OfflineEventType.sos,
      payload: {'deviceId': 'watch-1', 'latitude': 6.5},
      occurredAt: DateTime.utc(2026, 7, 11, 12),
      idempotencyKey: 'key-abc',
    );

    final restored = OfflineEvent.fromStorageJson(event.toStorageJson());
    expect(restored.id, event.id);
    expect(restored.type, event.type);
    expect(restored.idempotencyKey, event.idempotencyKey);
    expect(restored.payload['latitude'], 6.5);
  });

  test('offline sync json matches API contract shape', () {
    final event = OfflineEvent(
      id: 'evt-2',
      type: OfflineEventType.gps,
      payload: {'latitude': 1, 'longitude': 2},
      occurredAt: DateTime.utc(2026, 7, 11, 13),
    );

    final sync = event.toSyncJson();
    expect(sync['eventType'], 'GPS');
    expect(sync['occurredAt'], isA<String>());
    expect(sync['payload'], isA<Map<String, dynamic>>());
  });
}
