import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/offline_event.dart';
import 'secure_credential_store.dart';

/// Keystore-backed encrypted offline queue (no plaintext SOS payloads in prefs).
class EncryptedOfflineQueueStore {
  EncryptedOfflineQueueStore({
    FlutterSecureStorage? secureStorage,
    PreferencesStore? legacyPreferences,
    Map<String, String>? memory,
  })  : _secure = secureStorage ?? const FlutterSecureStorage(),
        _legacy = legacyPreferences,
        _memory = memory,
        _available = memory != null || secureStorage != null;

  static const _storageKey = 'watch.offline_queue.enc.v1';
  static const _schemaVersion = 1;

  final FlutterSecureStorage _secure;
  final PreferencesStore? _legacy;
  final Map<String, String>? _memory;
  final bool _available;

  bool get isAvailable => _available;

  Future<List<OfflineEvent>> loadQueue() async {
    if (!_available) {
      throw StateError('Encrypted offline queue unavailable on this target');
    }
    await _migrateLegacyIfNeeded();
    final raw = await _read(_storageKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      if (decoded['schemaVersion'] != _schemaVersion) {
        throw FormatException('Unsupported queue schema');
      }
      final eventsRaw = decoded['events'] as List<dynamic>? ?? [];
      return eventsRaw
          .map(
            (item) => OfflineEvent.fromStorageJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } catch (_) {
      await clear();
      throw StateError('Offline queue corrupted — cleared for safety');
    }
  }

  Future<void> saveQueue(List<OfflineEvent> events) async {
    if (!_available) {
      throw StateError('Encrypted offline queue unavailable on this target');
    }
    final envelope = jsonEncode({
      'schemaVersion': _schemaVersion,
      'events': events.map((e) => e.toStorageJson()).toList(),
      'savedAt': DateTime.now().toUtc().toIso8601String(),
    });
    await _write(_storageKey, envelope);
  }

  Future<void> clear() async {
    if (_memory != null) {
      _memory.remove(_storageKey);
      return;
    }
    await _secure.delete(key: _storageKey);
    if (_legacy != null) {
      await _legacy.saveOfflineQueue([]);
    }
  }

  Future<void> _migrateLegacyIfNeeded() async {
    final legacy = _legacy;
    if (legacy == null) return;
    final existing = await _read(_storageKey);
    if (existing != null && existing.isNotEmpty) return;
    final plaintext = await legacy.loadOfflineQueue();
    if (plaintext.isEmpty) return;
    await saveQueue(plaintext);
    await legacy.saveOfflineQueue([]);
  }

  Future<String?> _read(String key) async {
    if (_memory != null) return _memory[key];
    return _secure.read(key: key);
  }

  Future<void> _write(String key, String value) async {
    if (_memory != null) {
      _memory[key] = value;
      return;
    }
    await _secure.write(key: key, value: value);
  }
}
