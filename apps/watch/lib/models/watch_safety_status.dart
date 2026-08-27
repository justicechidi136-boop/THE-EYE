import '../alerts/danger_alert_models.dart';
import '../l10n/generated/watch_localizations.dart';

enum WatchSafetyLevel { safe, highAlert, danger }

class WatchSafetyStatus {
  const WatchSafetyStatus({
    required this.level,
    this.alertId,
    this.dangerCode,
    this.dangerType,
    this.areaName,
    this.distanceMeters,
    this.priority,
    this.issuedAt,
    this.expiresAt,
  });

  static const safe = WatchSafetyStatus(level: WatchSafetyLevel.safe);

  final WatchSafetyLevel level;
  final String? alertId;
  final String? dangerCode;
  final String? dangerType;
  final String? areaName;
  final int? distanceMeters;
  final DangerAlertPriority? priority;
  final DateTime? issuedAt;
  final DateTime? expiresAt;

  bool get isLive => level != WatchSafetyLevel.safe;

  factory WatchSafetyStatus.fromTrustedPayload(DangerAlertPayload payload) {
    if (payload.isExpired || payload.isCleared) {
      return WatchSafetyStatus.safe;
    }
    if (!DangerAlertCodes.isTrusted(payload.alertCode)) {
      return WatchSafetyStatus.safe;
    }
    final level = payload.alertCode == DangerAlertCodes.proximityIncrease
        ? WatchSafetyLevel.highAlert
        : WatchSafetyLevel.danger;
    return WatchSafetyStatus(
      level: level,
      alertId: payload.alertId,
      dangerCode: payload.alertCode,
      dangerType: payload.alertCode,
      areaName: payload.areaName,
      distanceMeters: payload.distanceMeters,
      priority: payload.priority,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    );
  }

  factory WatchSafetyStatus.fromStorageJson(Map<String, dynamic> json) {
    final levelName = json['level']?.toString();
    final code = json['dangerCode']?.toString();
    final expiresAt = _parseDate(json['expiresAt']?.toString());
    final lifecycle = DangerAlertLifecycleState.parse(
      json['lifecycleState']?.toString(),
    );

    if (expiresAt != null && DateTime.now().toUtc().isAfter(expiresAt)) {
      return WatchSafetyStatus.safe;
    }
    if (lifecycle == DangerAlertLifecycleState.cleared ||
        lifecycle == DangerAlertLifecycleState.expired) {
      return WatchSafetyStatus.safe;
    }
    if (!DangerAlertCodes.isTrusted(code) || code == DangerAlertCodes.cleared) {
      return WatchSafetyStatus.safe;
    }

    final level = WatchSafetyLevel.values.firstWhere(
      (value) => value.name == levelName,
      orElse: () => code == DangerAlertCodes.proximityIncrease
          ? WatchSafetyLevel.highAlert
          : WatchSafetyLevel.danger,
    );
    if (level == WatchSafetyLevel.safe) return WatchSafetyStatus.safe;

    return WatchSafetyStatus(
      level: level,
      alertId: json['alertId']?.toString(),
      dangerCode: code,
      dangerType: code,
      areaName: json['areaName']?.toString(),
      distanceMeters: int.tryParse(json['distanceMeters']?.toString() ?? ''),
      issuedAt: _parseDate(json['issuedAt']?.toString()),
      expiresAt: expiresAt,
    );
  }

  Map<String, dynamic> toStorageJson() => {
    'level': level.name,
    if (alertId != null) 'alertId': alertId,
    if (dangerCode != null) 'dangerCode': dangerCode,
    if (dangerType != null) 'dangerType': dangerType,
    if (areaName != null) 'areaName': areaName,
    if (distanceMeters != null) 'distanceMeters': distanceMeters,
    if (priority != null) 'priority': priority!.name,
    if (issuedAt != null) 'issuedAt': issuedAt!.toUtc().toIso8601String(),
    if (expiresAt != null) 'expiresAt': expiresAt!.toUtc().toIso8601String(),
  };

  static DateTime? _parseDate(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw)?.toUtc();
  }
}

abstract final class WatchDangerLabels {
  static String labelFor(WatchLocalizations l10n, String? code) {
    return switch (code) {
      DangerAlertCodes.armedRobberyNearby => l10n.dangerTypeArmedRobbery,
      DangerAlertCodes.kidnappingNearby => l10n.dangerTypeKidnapping,
      DangerAlertCodes.violentAttackNearby => l10n.dangerTypeViolentAttack,
      DangerAlertCodes.activeShooterNearby => l10n.dangerTypeActiveShooter,
      DangerAlertCodes.communalViolenceNearby =>
        l10n.dangerTypeCommunalViolence,
      DangerAlertCodes.banditAttackNearby ||
      DangerAlertCodes.killingNearby => l10n.dangerTypeViolentAttack,
      DangerAlertCodes.cultClashNearby ||
      DangerAlertCodes.communityCrisisNearby => l10n.dangerTypeCommunalViolence,
      DangerAlertCodes.terroristThreatNearby => l10n.dangerTypeTerroristThreat,
      DangerAlertCodes.fireNearby => l10n.dangerTypeFire,
      DangerAlertCodes.floodNearby => l10n.dangerTypeFlood,
      DangerAlertCodes.gasLeakNearby => l10n.dangerTypeGasLeak,
      DangerAlertCodes.hazardousAreaNearby => l10n.dangerTypeHazardousArea,
      DangerAlertCodes.roadDangerNearby => l10n.dangerTypeRoadDanger,
      DangerAlertCodes.buildingCollapseNearby =>
        l10n.dangerTypeBuildingCollapse,
      DangerAlertCodes.civilDisturbanceNearby =>
        l10n.dangerTypeCivilDisturbance,
      DangerAlertCodes.policeAdvisoryNearby => l10n.dangerTypePoliceAdvisory,
      DangerAlertCodes.missingChildNearby => l10n.dangerTypeMissingChild,
      DangerAlertCodes.evacuationNearby => l10n.dangerTypeEvacuation,
      DangerAlertCodes.proximityIncrease => l10n.highAlert,
      DangerAlertCodes.cleared => l10n.areaCleared,
      _ => l10n.dangerAlert,
    };
  }

  static String nearbyLabel(WatchLocalizations l10n, String? code) {
    final label = labelFor(l10n, code);
    if (code == DangerAlertCodes.proximityIncrease ||
        code == DangerAlertCodes.cleared) {
      return label;
    }
    return '$label ${l10n.nearby.toLowerCase()}';
  }
}
