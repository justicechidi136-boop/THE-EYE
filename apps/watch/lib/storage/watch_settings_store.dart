import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Typed local + cached server watch settings with schema versioning.
class WatchSettingsStore {
  WatchSettingsStore({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  static const _schemaVersion = 1;
  static const _settingsKey = 'watch.settings.v1';

  Future<SharedPreferences> get prefs async =>
      _preferences ??= await SharedPreferences.getInstance();

  Future<WatchSettings> load() async {
    final store = await prefs;
    final raw = store.getString(_settingsKey);
    if (raw == null || raw.isEmpty) return WatchSettings.defaults();
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      if ((json['schemaVersion'] as num?)?.toInt() != _schemaVersion) {
        return WatchSettings.defaults();
      }
      return WatchSettings.fromJson(json);
    } catch (_) {
      return WatchSettings.defaults();
    }
  }

  Future<void> save(WatchSettings settings) async {
    final store = await prefs;
    await store.setString(
      _settingsKey,
      jsonEncode(settings.copyWith(schemaVersion: _schemaVersion).toJson()),
    );
  }

  Future<void> resetToDefaults() => save(WatchSettings.defaults());

  Future<void> clearSensitive() async {
    final current = await load();
    await save(WatchSettings.defaults().copyWith(
      themeMode: current.themeMode,
      diagnosticDisplay: current.diagnosticDisplay,
    ));
  }

  WatchSettings mergePolicy(WatchSettings local, WatchServerPolicy? policy) {
    if (policy == null) return local;
    var merged = local;
    if (policy.criticalAlertsMandatory) {
      merged = merged.copyWith(criticalAlertsEnabled: true);
    }
    if (policy.maxSosCountdownSeconds != null) {
      merged = merged.copyWith(
        sosCountdownSeconds: merged.sosCountdownSeconds.clamp(
          1,
          policy.maxSosCountdownSeconds!,
        ),
      );
    }
    if (policy.preferredConnectionMode != null) {
      merged = merged.copyWith(
        preferredConnectionMode: policy.preferredConnectionMode!,
      );
    }
    if (policy.displayName != null && policy.displayName!.isNotEmpty) {
      merged = merged.copyWith(deviceDisplayName: policy.displayName);
    }
    return merged;
  }
}

class WatchServerPolicy {
  const WatchServerPolicy({
    this.criticalAlertsMandatory = true,
    this.maxSosCountdownSeconds,
    this.preferredConnectionMode,
    this.displayName,
    this.approvedNotificationCategories = const [],
  });

  final bool criticalAlertsMandatory;
  final int? maxSosCountdownSeconds;
  final String? preferredConnectionMode;
  final String? displayName;
  final List<String> approvedNotificationCategories;

  factory WatchServerPolicy.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const WatchServerPolicy();
    return WatchServerPolicy(
      criticalAlertsMandatory: json['criticalAlertsMandatory'] as bool? ?? true,
      maxSosCountdownSeconds: (json['maxSosCountdownSeconds'] as num?)?.toInt(),
      preferredConnectionMode: json['preferredConnectionMode'] as String?,
      displayName: json['displayName'] as String?,
      approvedNotificationCategories: (json['approvedNotificationCategories']
              as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList() ??
          const [],
    );
  }
}

class WatchSettings {
  const WatchSettings({
    this.schemaVersion = WatchSettingsStore._schemaVersion,
    this.sosCountdownSeconds = 3,
    this.sosHoldDurationMs = 3000,
    this.themeMode = 'system',
    this.discreetModePreferred = false,
    this.vibrationEnabled = true,
    this.failoverEnabled = true,
    this.alertRadiusMeters = 500,
    this.diagnosticDisplay = false,
    this.preferredConnectionMode = 'pairedPhone',
    this.criticalAlertsEnabled = true,
    this.deviceDisplayName,
  });

  final int schemaVersion;
  final int sosCountdownSeconds;
  final int sosHoldDurationMs;
  final String themeMode;
  final bool discreetModePreferred;
  final bool vibrationEnabled;
  final bool failoverEnabled;
  final int alertRadiusMeters;
  final bool diagnosticDisplay;
  final String preferredConnectionMode;
  final bool criticalAlertsEnabled;
  final String? deviceDisplayName;

  static WatchSettings defaults() => const WatchSettings();

  WatchSettings copyWith({
    int? schemaVersion,
    int? sosCountdownSeconds,
    int? sosHoldDurationMs,
    String? themeMode,
    bool? discreetModePreferred,
    bool? vibrationEnabled,
    bool? failoverEnabled,
    int? alertRadiusMeters,
    bool? diagnosticDisplay,
    String? preferredConnectionMode,
    bool? criticalAlertsEnabled,
    String? deviceDisplayName,
  }) {
    return WatchSettings(
      schemaVersion: schemaVersion ?? this.schemaVersion,
      sosCountdownSeconds: sosCountdownSeconds ?? this.sosCountdownSeconds,
      sosHoldDurationMs: sosHoldDurationMs ?? this.sosHoldDurationMs,
      themeMode: themeMode ?? this.themeMode,
      discreetModePreferred:
          discreetModePreferred ?? this.discreetModePreferred,
      vibrationEnabled: vibrationEnabled ?? this.vibrationEnabled,
      failoverEnabled: failoverEnabled ?? this.failoverEnabled,
      alertRadiusMeters: alertRadiusMeters ?? this.alertRadiusMeters,
      diagnosticDisplay: diagnosticDisplay ?? this.diagnosticDisplay,
      preferredConnectionMode:
          preferredConnectionMode ?? this.preferredConnectionMode,
      criticalAlertsEnabled:
          criticalAlertsEnabled ?? this.criticalAlertsEnabled,
      deviceDisplayName: deviceDisplayName ?? this.deviceDisplayName,
    );
  }

  Map<String, dynamic> toJson() => {
        'schemaVersion': schemaVersion,
        'sosCountdownSeconds': sosCountdownSeconds,
        'sosHoldDurationMs': sosHoldDurationMs,
        'themeMode': themeMode,
        'discreetModePreferred': discreetModePreferred,
        'vibrationEnabled': vibrationEnabled,
        'failoverEnabled': failoverEnabled,
        'alertRadiusMeters': alertRadiusMeters,
        'diagnosticDisplay': diagnosticDisplay,
        'preferredConnectionMode': preferredConnectionMode,
        'criticalAlertsEnabled': criticalAlertsEnabled,
        'deviceDisplayName': deviceDisplayName,
      };

  factory WatchSettings.fromJson(Map<String, dynamic> json) {
    return WatchSettings(
      schemaVersion: (json['schemaVersion'] as num?)?.toInt() ??
          WatchSettingsStore._schemaVersion,
      sosCountdownSeconds:
          ((json['sosCountdownSeconds'] as num?)?.toInt() ?? 3).clamp(1, 10),
      sosHoldDurationMs:
          ((json['sosHoldDurationMs'] as num?)?.toInt() ?? 3000).clamp(
        1000,
        8000,
      ),
      themeMode: json['themeMode'] as String? ?? 'system',
      discreetModePreferred: json['discreetModePreferred'] as bool? ?? false,
      vibrationEnabled: json['vibrationEnabled'] as bool? ?? true,
      failoverEnabled: json['failoverEnabled'] as bool? ?? true,
      alertRadiusMeters:
          ((json['alertRadiusMeters'] as num?)?.toInt() ?? 500).clamp(
        100,
        5000,
      ),
      diagnosticDisplay: json['diagnosticDisplay'] as bool? ?? false,
      preferredConnectionMode:
          json['preferredConnectionMode'] as String? ?? 'pairedPhone',
      criticalAlertsEnabled: json['criticalAlertsEnabled'] as bool? ?? true,
      deviceDisplayName: json['deviceDisplayName'] as String?,
    );
  }
}
