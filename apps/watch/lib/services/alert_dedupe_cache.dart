import 'dart:convert';

import '../alerts/danger_alert_models.dart';
import '../storage/secure_credential_store.dart';

class AlertDedupeEntry {
  const AlertDedupeEntry({
    required this.deterministicAlertId,
    required this.receivedAt,
    this.acknowledged = false,
    this.source,
  });

  final String deterministicAlertId;
  final DateTime receivedAt;
  final bool acknowledged;
  final String? source;

  Map<String, dynamic> toJson() => {
        'deterministicAlertId': deterministicAlertId,
        'receivedAt': receivedAt.toIso8601String(),
        'acknowledged': acknowledged,
        if (source != null) 'source': source,
      };

  factory AlertDedupeEntry.fromJson(Map<String, dynamic> json) {
    return AlertDedupeEntry(
      deterministicAlertId: json['deterministicAlertId'] as String,
      receivedAt: DateTime.parse(json['receivedAt'] as String),
      acknowledged: json['acknowledged'] as bool? ?? false,
      source: json['source'] as String?,
    );
  }
}

class AlertDedupeCache {
  AlertDedupeCache({required PreferencesStore preferences, Duration? ttl})
      : _preferences = preferences,
        _ttl = ttl ?? const Duration(hours: 24);

  final PreferencesStore _preferences;
  final Duration _ttl;

  Future<bool> shouldSuppress({
    required String deterministicAlertId,
    DangerAlertDeliverySource? incomingSource,
  }) async {
    final entries = await _preferences.loadAlertDedupeEntries();
    final existing = entries[deterministicAlertId];
    if (existing == null) return false;
    if (DateTime.now().difference(existing.receivedAt) > _ttl) return false;
    if (existing.acknowledged) return true;
    if (incomingSource == DangerAlertDeliverySource.fcm &&
        existing.source == DangerAlertDeliverySource.phoneRelay.name) {
      return true;
    }
    return true;
  }

  Future<void> record({
    required String deterministicAlertId,
    required DangerAlertDeliverySource source,
    bool acknowledged = false,
  }) async {
    final entries = await _preferences.loadAlertDedupeEntries();
    entries[deterministicAlertId] = AlertDedupeEntry(
      deterministicAlertId: deterministicAlertId,
      receivedAt: DateTime.now(),
      acknowledged: acknowledged,
      source: source.name,
    );
    await _preferences.saveAlertDedupeEntries(entries);
  }

  Future<void> markAcknowledged(String deterministicAlertId) async {
    final entries = await _preferences.loadAlertDedupeEntries();
    final existing = entries[deterministicAlertId];
    if (existing == null) return;
    entries[deterministicAlertId] = AlertDedupeEntry(
      deterministicAlertId: deterministicAlertId,
      receivedAt: existing.receivedAt,
      acknowledged: true,
      source: existing.source,
    );
    await _preferences.saveAlertDedupeEntries(entries);
  }
}

extension AlertDedupePreferences on PreferencesStore {
  static const _dedupeKey = 'watch.alert_dedupe_cache';

  Future<Map<String, AlertDedupeEntry>> loadAlertDedupeEntries() async {
    final store = await prefs;
    final raw = store.getString(_dedupeKey);
    if (raw == null || raw.isEmpty) return {};
    final decoded = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    return decoded.map(
      (key, value) => MapEntry(
        key,
        AlertDedupeEntry.fromJson(Map<String, dynamic>.from(value as Map)),
      ),
    );
  }

  Future<void> saveAlertDedupeEntries(Map<String, AlertDedupeEntry> entries) async {
    final store = await prefs;
    final encoded = jsonEncode(
      entries.map((key, value) => MapEntry(key, value.toJson())),
    );
    await store.setString(_dedupeKey, encoded);
  }
}
