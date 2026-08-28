/// Structured danger-zone alert codes — only trusted codes may trigger speech.
abstract final class DangerAlertCodes {
  static const armedRobberyNearby = 'DANGER_ZONE_ARMED_ROBBERY_NEARBY';
  static const kidnappingNearby = 'DANGER_ZONE_KIDNAPPING_NEARBY';
  static const violentAttackNearby = 'DANGER_ZONE_VIOLENT_ATTACK_NEARBY';
  static const activeShooterNearby = 'DANGER_ZONE_ACTIVE_SHOOTER_NEARBY';
  static const communalViolenceNearby = 'DANGER_ZONE_COMMUNAL_VIOLENCE_NEARBY';
  static const banditAttackNearby = 'DANGER_ZONE_BANDIT_ATTACK_NEARBY';
  static const cultClashNearby = 'DANGER_ZONE_CULT_CLASH_NEARBY';
  static const communityCrisisNearby = 'DANGER_ZONE_COMMUNITY_CRISIS_NEARBY';
  static const killingNearby = 'DANGER_ZONE_KILLING_NEARBY';
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
    banditAttackNearby,
    cultClashNearby,
    communityCrisisNearby,
    killingNearby,
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

enum DangerAlertDeliverySource { fcm, phoneRelay }

enum DangerAlertLifecycleState {
  active,
  updated,
  escalated,
  acknowledged,
  cleared,
  expired;

  static DangerAlertLifecycleState? parse(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final normalized = raw.trim().toUpperCase();
    for (final value in DangerAlertLifecycleState.values) {
      if (value.name.toUpperCase() == normalized) return value;
    }
    return null;
  }

  String get wireValue => name.toUpperCase();
}

class DangerAlertPayload {
  const DangerAlertPayload({
    required this.schemaVersion,
    required this.alertId,
    required this.version,
    required this.sequence,
    required this.lifecycleState,
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
    this.hasOriginalVoice = false,
    this.deliverySource = DangerAlertDeliverySource.fcm,
    this.signature,
    this.signatureKeyId,
    this.signedAt,
    required this.issuedAtWire,
  });

  final int schemaVersion;
  final String alertId;
  final int version;
  final int sequence;
  final DangerAlertLifecycleState lifecycleState;
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
  final bool hasOriginalVoice;
  final DangerAlertDeliverySource deliverySource;
  final String? signature;
  final String? signatureKeyId;
  final String? signedAt;
  final String issuedAtWire;

  String get dedupeKey => '$alertId-v$version';

  bool get isExpired => expiresAt != null && DateTime.now().isAfter(expiresAt!);

  bool get isCleared =>
      lifecycleState == DangerAlertLifecycleState.cleared || allClear;

  bool get isEscalation =>
      lifecycleState == DangerAlertLifecycleState.escalated;

  DangerAlertPayload copyWith({
    DangerAlertDeliverySource? deliverySource,
    String? notificationId,
    String? displayTitle,
    String? displayBody,
  }) {
    return DangerAlertPayload(
      schemaVersion: schemaVersion,
      alertId: alertId,
      version: version,
      sequence: sequence,
      lifecycleState: lifecycleState,
      alertCode: alertCode,
      priority: priority,
      incidentId: incidentId,
      zoneId: zoneId,
      safetyAlertId: safetyAlertId,
      issuedAt: issuedAt,
      distanceMeters: distanceMeters,
      areaName: areaName,
      languageHint: languageHint,
      expiresAt: expiresAt,
      acknowledgementRequired: acknowledgementRequired,
      repeatCount: repeatCount,
      alertState: alertState,
      allClear: allClear,
      deepLink: deepLink,
      notificationId: notificationId ?? this.notificationId,
      displayTitle: displayTitle ?? this.displayTitle,
      displayBody: displayBody ?? this.displayBody,
      hasOriginalVoice: hasOriginalVoice,
      deliverySource: deliverySource ?? this.deliverySource,
      signature: signature,
      signatureKeyId: signatureKeyId,
      signedAt: signedAt,
      issuedAtWire: issuedAtWire,
    );
  }

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

    final issuedAtRaw = data['issuedAt']?.toString() ?? '';
    final issuedAt = parseDate(issuedAtRaw) ?? DateTime.now();
    final expiresAt = parseDate(data['expiresAt']?.toString());
    final lifecycle =
        DangerAlertLifecycleState.parse(
          data['alertLifecycleState']?.toString(),
        ) ??
        (data['allClear'] == 'true'
            ? DangerAlertLifecycleState.cleared
            : DangerAlertLifecycleState.active);

    return DangerAlertPayload(
      schemaVersion:
          int.tryParse(data['dangerAlertSchemaVersion']?.toString() ?? '') ?? 1,
      alertId:
          data['alertId']?.toString() ??
          data['safetyAlertId']?.toString() ??
          '',
      version: int.tryParse(data['alertVersion']?.toString() ?? '') ?? 1,
      sequence: int.tryParse(data['alertSequence']?.toString() ?? '') ?? 1,
      lifecycleState: lifecycle,
      alertCode: alertCode,
      priority: priority,
      incidentId: data['incidentId']?.toString() ?? '',
      zoneId: data['zoneId']?.toString() ?? '',
      safetyAlertId: data['safetyAlertId']?.toString() ?? '',
      distanceMeters: int.tryParse(data['distanceMeters']?.toString() ?? ''),
      areaName: data['areaName']?.toString(),
      languageHint: data['languageHint']?.toString(),
      issuedAt: issuedAt,
      issuedAtWire: issuedAtRaw.isNotEmpty
          ? issuedAtRaw
          : issuedAt.toUtc().toIso8601String(),
      expiresAt: expiresAt,
      acknowledgementRequired: data['acknowledgementRequired'] == 'true',
      repeatCount: int.tryParse(data['repeatCount']?.toString() ?? '') ?? 3,
      alertState: data['alertState']?.toString(),
      allClear: data['allClear'] == 'true',
      deepLink: data['deepLink']?.toString(),
      notificationId: data['notificationId']?.toString(),
      displayTitle: data['title']?.toString(),
      displayBody: data['body']?.toString(),
      hasOriginalVoice: data['hasOriginalVoice'] == 'true',
      signature: data['signature']?.toString(),
      signatureKeyId: data['signatureKeyId']?.toString(),
      signedAt: data['signedAt']?.toString(),
    );
  }
}

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
    this.quietHoursStart,
    this.quietHoursEnd,
    this.timeZoneId = 'Africa/Lagos',
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
  final String? quietHoursStart;
  final String? quietHoursEnd;
  final String timeZoneId;

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
    String? quietHoursStart,
    String? quietHoursEnd,
    String? timeZoneId,
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
      criticalAlertsOverrideSilentMode:
          criticalAlertsOverrideSilentMode ??
          this.criticalAlertsOverrideSilentMode,
      speakWhenPhoneConnected:
          speakWhenPhoneConnected ?? this.speakWhenPhoneConnected,
      speakWhenStandalone: speakWhenStandalone ?? this.speakWhenStandalone,
      speakOverHeadphones: speakOverHeadphones ?? this.speakOverHeadphones,
      speakSensitiveAlertsAloud:
          speakSensitiveAlertsAloud ?? this.speakSensitiveAlertsAloud,
      allowCriticalAlertDuringQuietHours:
          allowCriticalAlertDuringQuietHours ??
          this.allowCriticalAlertDuringQuietHours,
      acknowledgeRequired: acknowledgeRequired ?? this.acknowledgeRequired,
      autoLanguageFallback: autoLanguageFallback ?? this.autoLanguageFallback,
      quietHoursStart: quietHoursStart ?? this.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? this.quietHoursEnd,
      timeZoneId: timeZoneId ?? this.timeZoneId,
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
      quietHoursStart: json['quietHoursStart'] as String?,
      quietHoursEnd: json['quietHoursEnd'] as String?,
      timeZoneId: json['timeZoneId'] as String? ?? 'Africa/Lagos',
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
    'allowCriticalAlertDuringQuietHours': allowCriticalAlertDuringQuietHours,
    'acknowledgeRequired': acknowledgeRequired,
    'autoLanguageFallback': autoLanguageFallback,
    'quietHoursStart': quietHoursStart,
    'quietHoursEnd': quietHoursEnd,
    'timeZoneId': timeZoneId,
  };

  static VibrationStrength _parseVibrationStrength(Object? value) {
    final raw = value?.toString() ?? 'strong';
    return VibrationStrength.values.firstWhere(
      (item) => item.name == raw,
      orElse: () => VibrationStrength.strong,
    );
  }
}

DangerAlertPayload? parseDangerAlertPayload(
  Map<String, dynamic> data, {
  DangerAlertDeliverySource deliverySource = DangerAlertDeliverySource.fcm,
}) {
  try {
    final payload = DangerAlertPayload.fromFcmData(data);
    if (payload.isExpired) return null;
    return payload.copyWith(deliverySource: deliverySource);
  } catch (_) {
    return null;
  }
}
