import 'dart:convert';

import '../alerts/danger_alert_models.dart';
import '../storage/secure_credential_store.dart';

enum AlertVersionDecision {
  acceptFull,
  acceptUpdateOnly,
  suppressDuplicate,
  suppressOldVersion,
  suppressAfterCleared,
  suppressAcknowledged,
}

class AlertVersionEntry {
  const AlertVersionEntry({
    required this.alertId,
    required this.highestVersionSeen,
    required this.highestAckVersion,
    this.lifecycleState,
    required this.updatedAt,
    this.lastSource,
  });

  final String alertId;
  final int highestVersionSeen;
  final int highestAckVersion;
  final String? lifecycleState;
  final DateTime updatedAt;
  final String? lastSource;

  Map<String, dynamic> toJson() => {
        'alertId': alertId,
        'highestVersionSeen': highestVersionSeen,
        'highestAckVersion': highestAckVersion,
        if (lifecycleState != null) 'lifecycleState': lifecycleState,
        'updatedAt': updatedAt.toIso8601String(),
        if (lastSource != null) 'lastSource': lastSource,
      };

  factory AlertVersionEntry.fromJson(Map<String, dynamic> json) {
    return AlertVersionEntry(
      alertId: json['alertId'] as String,
      highestVersionSeen: json['highestVersionSeen'] as int? ?? 0,
      highestAckVersion: json['highestAckVersion'] as int? ?? 0,
      lifecycleState: json['lifecycleState'] as String?,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      lastSource: json['lastSource'] as String?,
    );
  }
}

class AlertVersionTracker {
  AlertVersionTracker({required PreferencesStore preferences, Duration? ttl})
      : _preferences = preferences,
        _ttl = ttl ?? const Duration(hours: 24);

  final PreferencesStore _preferences;
  final Duration _ttl;

  Future<AlertVersionDecision> evaluate(DangerAlertPayload payload) async {
    final entries = await _preferences.loadAlertVersionEntries();
    final existing = entries[payload.alertId];
    if (existing == null) return AlertVersionDecision.acceptFull;

    if (DateTime.now().difference(existing.updatedAt) > _ttl) {
      return AlertVersionDecision.acceptFull;
    }

    if (existing.lifecycleState == DangerAlertLifecycleState.cleared.name &&
        payload.lifecycleState != DangerAlertLifecycleState.cleared) {
      return AlertVersionDecision.suppressAfterCleared;
    }

    if (payload.version < existing.highestVersionSeen) {
      return AlertVersionDecision.suppressOldVersion;
    }

    if (payload.version == existing.highestVersionSeen) {
      if (payload.deliverySource == DangerAlertDeliverySource.fcm &&
          existing.lastSource == DangerAlertDeliverySource.phoneRelay.name) {
        return AlertVersionDecision.suppressDuplicate;
      }
      return AlertVersionDecision.suppressDuplicate;
    }

    if (payload.version <= existing.highestAckVersion) {
      return AlertVersionDecision.suppressAcknowledged;
    }

    if (payload.lifecycleState == DangerAlertLifecycleState.escalated ||
        payload.lifecycleState == DangerAlertLifecycleState.updated) {
      return AlertVersionDecision.acceptUpdateOnly;
    }

    return AlertVersionDecision.acceptFull;
  }

  Future<void> record(DangerAlertPayload payload) async {
    final entries = await _preferences.loadAlertVersionEntries();
    final existing = entries[payload.alertId];
    entries[payload.alertId] = AlertVersionEntry(
      alertId: payload.alertId,
      highestVersionSeen: payload.version > (existing?.highestVersionSeen ?? 0)
          ? payload.version
          : (existing?.highestVersionSeen ?? payload.version),
      highestAckVersion: existing?.highestAckVersion ?? 0,
      lifecycleState: payload.lifecycleState.name,
      updatedAt: DateTime.now(),
      lastSource: payload.deliverySource.name,
    );
    await _preferences.saveAlertVersionEntries(entries);
  }

  Future<void> markAcknowledged(DangerAlertPayload payload) async {
    final entries = await _preferences.loadAlertVersionEntries();
    final existing = entries[payload.alertId];
    entries[payload.alertId] = AlertVersionEntry(
      alertId: payload.alertId,
      highestVersionSeen: existing?.highestVersionSeen ?? payload.version,
      highestAckVersion: payload.version > (existing?.highestAckVersion ?? 0)
          ? payload.version
          : (existing?.highestAckVersion ?? payload.version),
      lifecycleState: DangerAlertLifecycleState.acknowledged.name,
      updatedAt: DateTime.now(),
      lastSource: existing?.lastSource,
    );
    await _preferences.saveAlertVersionEntries(entries);
  }
}

extension AlertVersionPreferences on PreferencesStore {
  static const _versionKey = 'watch.alert_version_tracker';

  Future<Map<String, AlertVersionEntry>> loadAlertVersionEntries() async {
    final store = await prefs;
    final raw = store.getString(_versionKey);
    if (raw == null || raw.isEmpty) return {};
    final decoded = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    return decoded.map(
      (key, value) => MapEntry(
        key,
        AlertVersionEntry.fromJson(Map<String, dynamic>.from(value as Map)),
      ),
    );
  }

  Future<void> saveAlertVersionEntries(Map<String, AlertVersionEntry> entries) async {
    final store = await prefs;
    final encoded = jsonEncode(
      entries.map((key, value) => MapEntry(key, value.toJson())),
    );
    await store.setString(_versionKey, encoded);
  }
}
