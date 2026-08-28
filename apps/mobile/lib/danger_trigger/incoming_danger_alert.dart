const _trustedDangerLabels = <String, String>{
  "DANGER_ZONE_ARMED_ROBBERY_NEARBY": "Active robbery",
  "DANGER_ZONE_KIDNAPPING_NEARBY": "Kidnapping",
  "DANGER_ZONE_VIOLENT_ATTACK_NEARBY": "Violent attack",
  "DANGER_ZONE_ACTIVE_SHOOTER_NEARBY": "Shooting or gunfire",
  "DANGER_ZONE_COMMUNAL_VIOLENCE_NEARBY": "Communal violence",
  "DANGER_ZONE_BANDIT_ATTACK_NEARBY": "Bandit or unknown gunmen attack",
  "DANGER_ZONE_CULT_CLASH_NEARBY": "Cult clash",
  "DANGER_ZONE_COMMUNITY_CRISIS_NEARBY": "Community crisis",
  "DANGER_ZONE_KILLING_NEARBY": "Killing",
  "DANGER_ZONE_TERRORIST_THREAT_NEARBY": "Terrorist threat",
  "DANGER_ZONE_FIRE_NEARBY": "Fire",
  "DANGER_ZONE_FLOOD_NEARBY": "Flood emergency",
  "DANGER_ZONE_GAS_LEAK_NEARBY": "Gas leak",
  "DANGER_ZONE_HAZARDOUS_AREA_NEARBY": "Hazardous area",
  "DANGER_ZONE_ROAD_DANGER_NEARBY": "Road hazard",
  "DANGER_ZONE_BUILDING_COLLAPSE_NEARBY": "Building collapse",
  "DANGER_ZONE_CIVIL_DISTURBANCE_NEARBY": "Riot",
  "DANGER_ZONE_POLICE_ADVISORY_NEARBY": "Police safety advisory",
  "DANGER_ZONE_MISSING_CHILD_NEARBY": "Missing child",
  "DANGER_ZONE_EVACUATION_NEARBY": "Evacuation",
  "DANGER_ZONE_GENERAL_ENTRY": "Other immediate danger",
  "DANGER_ZONE_PROXIMITY_INCREASE": "Danger moved closer",
};

class IncomingDangerAlert {
  const IncomingDangerAlert({
    required this.eventId,
    required this.alertId,
    required this.version,
    required this.dangerType,
    required this.area,
    required this.issuedAt,
    this.expiresAt,
    this.distanceMeters,
    this.liveAvailable = false,
    this.hasOriginalVoice = false,
    this.priority = "MEDIUM",
  });

  final String eventId;
  final String alertId;
  final int version;
  final String dangerType;
  final String area;
  final DateTime issuedAt;
  final DateTime? expiresAt;
  final int? distanceMeters;
  final bool liveAvailable;
  final bool hasOriginalVoice;
  final String priority;

  String get dedupeKey => "$alertId:$version";
  bool get isExpired =>
      expiresAt != null && !expiresAt!.isAfter(DateTime.now());
  String get spokenText => "Danger alert. $dangerType reported in $area.";
  int get priorityRank => switch (priority.toUpperCase()) {
    "CRITICAL" => 4,
    "HIGH" => 3,
    "MEDIUM" => 2,
    _ => 1,
  };

  static IncomingDangerAlert? fromData(Map<String, dynamic> data) {
    if (data["type"]?.toString() != "NearbyDangerWarning") return null;
    final state = data["alertLifecycleState"]?.toString().toUpperCase();
    if (state == "CLEARED" || state == "RESOLVED" || state == "FALSE_ALARM") {
      return null;
    }
    final code = data["dangerAlertCode"]?.toString() ?? "";
    final label = _trustedDangerLabels[code];
    if (label == null) return null;
    final alertId = data["alertId"]?.toString().trim() ?? "";
    final eventId = data["zoneId"]?.toString().trim().isNotEmpty == true
        ? data["zoneId"].toString().trim()
        : data["dangerEventId"]?.toString().trim() ?? "";
    final issuedAt = DateTime.tryParse(data["issuedAt"]?.toString() ?? "");
    if (alertId.isEmpty || eventId.isEmpty || issuedAt == null) return null;
    final parsed = IncomingDangerAlert(
      eventId: eventId,
      alertId: alertId,
      version: int.tryParse(data["alertVersion"]?.toString() ?? "") ?? 1,
      dangerType: label,
      area: _safeArea(data["areaName"]?.toString()),
      issuedAt: issuedAt,
      expiresAt: DateTime.tryParse(data["expiresAt"]?.toString() ?? ""),
      distanceMeters: int.tryParse(data["distanceMeters"]?.toString() ?? ""),
      liveAvailable: data["liveAvailable"]?.toString() == "true",
      hasOriginalVoice: data["hasOriginalVoice"]?.toString() == "true",
      priority: data["dangerAlertPriority"]?.toString() ?? "MEDIUM",
    );
    return parsed.isExpired ? null : parsed;
  }

  static String _safeArea(String? value) {
    final normalized = value?.trim() ?? "";
    if (normalized.isEmpty) return "your area";
    return normalized.length <= 80 ? normalized : normalized.substring(0, 80);
  }
}
