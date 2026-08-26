enum WatchAreaRiskLevel {
  unknown,
  greenSafe,
  mediumRisk,
  highRisk,
}

class WatchAreaRiskStatus {
  const WatchAreaRiskStatus({
    required this.level,
    required this.eventCount,
    required this.windowDays,
    required this.radiusMeters,
    this.approximateArea,
    this.evaluatedAt,
  });

  static const unknown = WatchAreaRiskStatus(
    level: WatchAreaRiskLevel.unknown,
    eventCount: 0,
    windowDays: 30,
    radiusMeters: 4000,
  );

  final WatchAreaRiskLevel level;
  final int eventCount;
  final int windowDays;
  final int radiusMeters;
  final String? approximateArea;
  final DateTime? evaluatedAt;

  factory WatchAreaRiskStatus.fromJson(Map<String, dynamic> json) {
    final level = switch (json['level']?.toString()) {
      'HIGH_RISK' => WatchAreaRiskLevel.highRisk,
      'MEDIUM_RISK' => WatchAreaRiskLevel.mediumRisk,
      'GREEN_SAFE' => WatchAreaRiskLevel.greenSafe,
      _ => WatchAreaRiskLevel.unknown,
    };
    return WatchAreaRiskStatus(
      level: level,
      eventCount: int.tryParse(json['eventCount']?.toString() ?? '') ?? 0,
      windowDays: int.tryParse(json['windowDays']?.toString() ?? '') ?? 30,
      radiusMeters:
          int.tryParse(json['radiusMeters']?.toString() ?? '') ?? 4000,
      approximateArea: json['approximateArea']?.toString(),
      evaluatedAt:
          DateTime.tryParse(json['evaluatedAt']?.toString() ?? '')?.toUtc(),
    );
  }
}
