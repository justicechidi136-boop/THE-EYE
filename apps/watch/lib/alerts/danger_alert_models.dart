/// Structured danger-zone alert codes — only trusted codes may trigger speech.
abstract final class DangerAlertCodes {
  static const armedRobberyNearby = 'DANGER_ZONE_ARMED_ROBBERY_NEARBY';
  static const kidnappingNearby = 'DANGER_ZONE_KIDNAPPING_NEARBY';
  static const violentAttackNearby = 'DANGER_ZONE_VIOLENT_ATTACK_NEARBY';
  static const activeShooterNearby = 'DANGER_ZONE_ACTIVE_SHOOTER_NEARBY';
  static const communalViolenceNearby = 'DANGER_ZONE_COMMUNAL_VIOLENCE_NEARBY';
  static const terroristThreatNearby = 'DANGER_ZONE_TERRORIST_THREAT_NEARBY';
  static const fireNearby = 'DANGER_ZONE_FIRE_NEARBY';
  static const floodNearby = 'DANGER_ZONE_FLOOD_NEARBY';
  static const gasLeakNearby = 'DANGER_ZONE_GAS_LEAK_NEARBY';
  static const hazardousAreaNearby = 'DANGER_ZONE_HAZARDOUS_AREA_NEARBY';
  static const roadDangerNearby = 'DANGER_ZONE_ROAD_DANGER_NEARBY';
  static const buildingCollapseNearby = 'DANGER_ZONE_BUILDING_COLLAPSE_NEARBY';
  static const civilDisturbanceNearby = 'DANGER_ZONE_CIVIL_DISTURBANCE_NEARBY';
  static const policeAdvisoryNearby = 'DANGER_ZONE_POLICE_ADVISORY_NEARBY';
  static const missingChildNearby = 'DANGER_ZONE_MISSING_CHILD_NEARBY';
  static const evacuationNearby = 'DANGER_ZONE_EVACUATION_NEARBY';
  static const generalEntry = 'DANGER_ZONE_GENERAL_ENTRY';
  static const proximityIncrease = 'DANGER_ZONE_PROXIMITY_INCREASE';
  static const cleared = 'DANGER_ZONE_CLEARED';

  static const trusted = <String>{
    armedRobberyNearby,
    kidnappingNearby,
    violentAttackNearby,
    activeShooterNearby,
    communalViolenceNearby,
    terroristThreatNearby,
    fireNearby,
    floodNearby,
    gasLeakNearby,
    hazardousAreaNearby,
    roadDangerNearby,
    buildingCollapseNearby,
    civilDisturbanceNearby,
    policeAdvisoryNearby,
    missingChildNearby,
    evacuationNearby,
    generalEntry,
    proximityIncrease,
    cleared,
  };

  static bool isTrusted(String? code) =>
      code != null && code.isNotEmpty && trusted.contains(code);
}

abstract final class SpokenLanguageCodes {
  static const english = 'en-NG';
  static const nigerianPidgin = 'pcm-NG';
  static const hausa = 'ha-NG';
  static const yoruba = 'yo-NG';
  static const igbo = 'ig-NG';
  static const french = 'fr';
  static const swahili = 'sw';

  static const supported = <String>{
    english,
    nigerianPidgin,
    hausa,
    yoruba,
    igbo,
    french,
    swahili,
  };

  /// Maps app language codes to Android TTS locale tags.
  static String ttsLocale(String code) {
    switch (code) {
      case nigerianPidgin:
        return 'en-NG';
      case hausa:
        return 'ha-NG';
      case yoruba:
        return 'yo-NG';
      case igbo:
        return 'ig-NG';
      case french:
        return 'fr-FR';
      case swahili:
        return 'sw-KE';
      default:
        return 'en-NG';
    }
  }
}

enum DangerAlertPriority { critical, high, medium, low }

enum VibrationStrength { strong, normal, reduced }

class WatchAccessibilityPreferences {
  const WatchAccessibilityPreferences({
    this.spokenDangerAlertsEnabled = true,
    this.preferredSpokenLanguage = SpokenLanguageCodes.english,
    this.speechRate = 0.45,
    this.speechPitch = 1.0,
    this.repeatCount = 3,
    this.repeatIntervalSeconds = 10,
    this.vibrationStrength = VibrationStrength.strong,
    this.criticalAlertsOverrideSilentMode = true,
    this.speakWhenPhoneConnected = true,
    this.speakWhenStandalone = true,
    this.speakOverHeadphones = true,
    this.speakSensitiveAlertsAloud = true,
    this.allowCriticalAlertDuringQuietHours = true,
    this.acknowledgeRequired = true,
    this.autoLanguageFallback = true,
  });

  final bool spokenDangerAlertsEnabled;
  final String preferredSpokenLanguage;
  final double speechRate;
  final double speechPitch;
  final int repeatCount;
  final int repeatIntervalSeconds;
  final VibrationStrength vibrationStrength;
  final bool criticalAlertsOverrideSilentMode;
  final bool speakWhenPhoneConnected;
  final bool speakWhenStandalone;
  final bool speakOverHeadphones;
  final bool speakSensitiveAlertsAloud;
  final bool allowCriticalAlertDuringQuietHours;
  final bool acknowledgeRequired;
  final bool autoLanguageFallback;

  WatchAccessibilityPreferences copyWith({
    bool? spokenDangerAlertsEnabled,
    String? preferredSpokenLanguage,
    double? speechRate,
    double? speechPitch,
    int? repeatCount,
    int? repeatIntervalSeconds,
    VibrationStrength? vibrationStrength,
    bool? criticalAlertsOverrideSilentMode,
    bool? speakWhenPhoneConnected,
    bool? speakWhenStandalone,
    bool? speakOverHeadphones,
    bool? speakSensitiveAlertsAloud,
    bool? allowCriticalAlertDuringQuietHours,
    bool? acknowledgeRequired,
    bool? autoLanguageFallback,
  }) {
    return WatchAccessibilityPreferences(
      spokenDangerAlertsEnabled:
          spokenDangerAlertsEnabled ?? this.spokenDangerAlertsEnabled,
      preferredSpokenLanguage:
          preferredSpokenLanguage ?? this.preferredSpokenLanguage,
      speechRate: speechRate ?? this.speechRate,
      speechPitch: speechPitch ?? this.speechPitch,
      repeatCount: repeatCount ?? this.repeatCount,
      repeatIntervalSeconds:
          repeatIntervalSeconds ?? this.repeatIntervalSeconds,
      vibrationStrength: vibrationStrength ?? this.vibrationStrength,
      criticalAlertsOverrideSilentMode: criticalAlertsOverrideSilentMode ??
          this.criticalAlertsOverrideSilentMode,
      speakWhenPhoneConnected:
          speakWhenPhoneConnected ?? this.speakWhenPhoneConnected,
      speakWhenStandalone: speakWhenStandalone ?? this.speakWhenStandalone,
      speakOverHeadphones: speakOverHeadphones ?? this.speakOverHeadphones,
      speakSensitiveAlertsAloud:
          speakSensitiveAlertsAloud ?? this.speakSensitiveAlertsAloud,
      allowCriticalAlertDuringQuietHours: allowCriticalAlertDuringQuietHours ??
          this.allowCriticalAlertDuringQuietHours,
      acknowledgeRequired: acknowledgeRequired ?? this.acknowledgeRequired,
      autoLanguageFallback: autoLanguageFallback ?? this.autoLanguageFallback,
    );
  }

  factory WatchAccessibilityPreferences.fromJson(Map<String, dynamic> json) {
    return WatchAccessibilityPreferences(
      spokenDangerAlertsEnabled:
          json['spokenDangerAlertsEnabled'] as bool? ?? true,
      preferredSpokenLanguage:
          json['preferredSpokenLanguage'] as String? ??
              SpokenLanguageCodes.english,
      speechRate: (json['speechRate'] as num?)?.toDouble() ?? 0.45,
      speechPitch: (json['speechPitch'] as num?)?.toDouble() ?? 1.0,
      repeatCount: (json['repeatCount'] as num?)?.toInt() ?? 3,
      repeatIntervalSeconds:
          (json['repeatIntervalSeconds'] as num?)?.toInt() ?? 10,
      vibrationStrength: _parseVibrationStrength(json['vibrationStrength']),
      criticalAlertsOverrideSilentMode:
          json['criticalAlertsOverrideSilentMode'] as bool? ?? true,
      speakWhenPhoneConnected: json['speakWhenPhoneConnected'] as bool? ?? true,
      speakWhenStandalone: json['speakWhenStandalone'] as bool? ?? true,
      speakOverHeadphones: json['speakOverHeadphones'] as bool? ?? true,
      speakSensitiveAlertsAloud:
          json['speakSensitiveAlertsAloud'] as bool? ?? true,
      allowCriticalAlertDuringQuietHours:
          json['allowCriticalAlertDuringQuietHours'] as bool? ?? true,
      acknowledgeRequired: json['acknowledgeRequired'] as bool? ?? true,
      autoLanguageFallback: json['autoLanguageFallback'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'spokenDangerAlertsEnabled': spokenDangerAlertsEnabled,
        'preferredSpokenLanguage': preferredSpokenLanguage,
        'speechRate': speechRate,
        'speechPitch': speechPitch,
        'repeatCount': repeatCount,
        'repeatIntervalSeconds': repeatIntervalSeconds,
        'vibrationStrength': vibrationStrength.name,
        'criticalAlertsOverrideSilentMode': criticalAlertsOverrideSilentMode,
        'speakWhenPhoneConnected': speakWhenPhoneConnected,
        'speakWhenStandalone': speakWhenStandalone,
        'speakOverHeadphones': speakOverHeadphones,
        'speakSensitiveAlertsAloud': speakSensitiveAlertsAloud,
        'allowCriticalAlertDuringQuietHours':
            allowCriticalAlertDuringQuietHours,
        'acknowledgeRequired': acknowledgeRequired,
        'autoLanguageFallback': autoLanguageFallback,
      };

  static VibrationStrength _parseVibrationStrength(Object? value) {
    final raw = value?.toString() ?? 'strong';
    return VibrationStrength.values.firstWhere(
      (item) => item.name == raw,
      orElse: () => VibrationStrength.strong,
    );
  }
}

class DangerAlertPayload {
  const DangerAlertPayload({
    required this.alertCode,
    required this.priority,
    required this.incidentId,
    required this.zoneId,
    required this.safetyAlertId,
    required this.issuedAt,
    this.distanceMeters,
    this.areaName,
    this.languageHint,
    this.expiresAt,
    this.acknowledgementRequired = true,
    this.repeatCount = 3,
    this.alertState,
    this.allClear = false,
    this.deepLink,
    this.notificationId,
    this.displayTitle,
    this.displayBody,
  });

  final String alertCode;
  final DangerAlertPriority priority;
  final String incidentId;
  final String zoneId;
  final String safetyAlertId;
  final DateTime issuedAt;
  final int? distanceMeters;
  final String? areaName;
  final String? languageHint;
  final DateTime? expiresAt;
  final bool acknowledgementRequired;
  final int repeatCount;
  final String? alertState;
  final bool allClear;
  final String? deepLink;
  final String? notificationId;
  final String? displayTitle;
  final String? displayBody;

  String get dedupeKey => '$safetyAlertId:${alertState ?? alertCode}';

  bool get isExpired =>
      expiresAt != null && DateTime.now().isAfter(expiresAt!);

  factory DangerAlertPayload.fromFcmData(Map<String, dynamic> data) {
    final alertCode = data['dangerAlertCode']?.toString() ?? '';
    if (!DangerAlertCodes.isTrusted(alertCode)) {
      throw FormatException('Untrusted alert code');
    }

    final priorityRaw =
        data['dangerAlertPriority']?.toString().toUpperCase() ?? 'MEDIUM';
    final priority = switch (priorityRaw) {
      'CRITICAL' => DangerAlertPriority.critical,
      'HIGH' => DangerAlertPriority.high,
      'LOW' => DangerAlertPriority.low,
      _ => DangerAlertPriority.medium,
    };

    DateTime? parseDate(String? raw) {
      if (raw == null || raw.isEmpty) return null;
      final parsed = DateTime.tryParse(raw);
      return parsed?.toUtc();
    }

    final issuedAt = parseDate(data['issuedAt']?.toString()) ?? DateTime.now();
    final expiresAt = parseDate(data['expiresAt']?.toString());

    return DangerAlertPayload(
      alertCode: alertCode,
      priority: priority,
      incidentId: data['incidentId']?.toString() ?? '',
      zoneId: data['zoneId']?.toString() ?? '',
      safetyAlertId: data['safetyAlertId']?.toString() ?? '',
      distanceMeters: int.tryParse(data['distanceMeters']?.toString() ?? ''),
      areaName: data['areaName']?.toString(),
      languageHint: data['languageHint']?.toString(),
      issuedAt: issuedAt,
      expiresAt: expiresAt,
      acknowledgementRequired: data['acknowledgementRequired'] == 'true',
      repeatCount: int.tryParse(data['repeatCount']?.toString() ?? '') ?? 3,
      alertState: data['alertState']?.toString(),
      allClear: data['allClear'] == 'true',
      deepLink: data['deepLink']?.toString(),
      notificationId: data['notificationId']?.toString(),
      displayTitle: data['title']?.toString(),
      displayBody: data['body']?.toString(),
    );
  }
}


DangerAlertPayload? parseDangerAlertPayload(Map<String, dynamic> data) {
  try {
    final payload = DangerAlertPayload.fromFcmData(data);
    if (payload.isExpired) return null;
    return payload;
  } catch (_) {
    return null;
  }
}
