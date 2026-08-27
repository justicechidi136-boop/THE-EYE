const _trustedLabels = <String, String>{
  'DANGER_ZONE_ARMED_ROBBERY_NEARBY': 'ACTIVE ROBBERY',
  'DANGER_ZONE_KIDNAPPING_NEARBY': 'KIDNAPPING',
  'DANGER_ZONE_VIOLENT_ATTACK_NEARBY': 'VIOLENT ATTACK',
  'DANGER_ZONE_ACTIVE_SHOOTER_NEARBY': 'GUNFIRE',
  'DANGER_ZONE_COMMUNAL_VIOLENCE_NEARBY': 'COMMUNAL VIOLENCE',
  'DANGER_ZONE_TERRORIST_THREAT_NEARBY': 'TERRORIST THREAT',
  'DANGER_ZONE_FIRE_NEARBY': 'FIRE',
  'DANGER_ZONE_FLOOD_NEARBY': 'FLOOD EMERGENCY',
  'DANGER_ZONE_GAS_LEAK_NEARBY': 'GAS LEAK',
  'DANGER_ZONE_HAZARDOUS_AREA_NEARBY': 'HAZARDOUS AREA',
  'DANGER_ZONE_ROAD_DANGER_NEARBY': 'ROAD HAZARD',
  'DANGER_ZONE_BUILDING_COLLAPSE_NEARBY': 'BUILDING COLLAPSE',
  'DANGER_ZONE_CIVIL_DISTURBANCE_NEARBY': 'CIVIL DISTURBANCE',
  'DANGER_ZONE_POLICE_ADVISORY_NEARBY': 'POLICE SAFETY ADVISORY',
  'DANGER_ZONE_MISSING_CHILD_NEARBY': 'MISSING CHILD',
  'DANGER_ZONE_EVACUATION_NEARBY': 'EVACUATION',
  'DANGER_ZONE_GENERAL_ENTRY': 'OTHER IMMEDIATE DANGER',
  'DANGER_ZONE_PROXIMITY_INCREASE': 'DANGER MOVED CLOSER',
};

class FieldDangerAlert {
  const FieldDangerAlert({
    required this.eventId,
    required this.alertId,
    required this.version,
    required this.dangerType,
    required this.area,
    required this.issuedAt,
    this.expiresAt,
    this.distanceMeters,
  });

  final String eventId;
  final String alertId;
  final int version;
  final String dangerType;
  final String area;
  final DateTime issuedAt;
  final DateTime? expiresAt;
  final int? distanceMeters;

  String get dedupeKey => '$alertId:$version';
  String get speech =>
      '$dangerType danger alert. $dangerType reported in $area.';
  String get distanceLabel {
    final distance = distanceMeters;
    if (distance == null) return '';
    return distance < 1000
        ? 'About $distance m away'
        : 'About ${(distance / 1000).toStringAsFixed(1)} km away';
  }

  bool get expired => expiresAt != null && !expiresAt!.isAfter(DateTime.now());

  static FieldDangerAlert? fromData(Map<String, dynamic> data) {
    if (data['type']?.toString() != 'NearbyDangerWarning') return null;
    final state = data['alertLifecycleState']?.toString().toUpperCase();
    if (state == 'CLEARED' || state == 'RESOLVED' || state == 'FALSE_ALARM') {
      return null;
    }
    final label = _trustedLabels[data['dangerAlertCode']?.toString()];
    final alertId = data['alertId']?.toString().trim() ?? '';
    final eventId = data['zoneId']?.toString().trim() ?? '';
    final issuedAt = DateTime.tryParse(data['issuedAt']?.toString() ?? '');
    if (label == null ||
        alertId.isEmpty ||
        eventId.isEmpty ||
        issuedAt == null) {
      return null;
    }
    final areaRaw = data['areaName']?.toString().trim() ?? '';
    final value = FieldDangerAlert(
      eventId: eventId,
      alertId: alertId,
      version: int.tryParse(data['alertVersion']?.toString() ?? '') ?? 1,
      dangerType: label,
      area:
          areaRaw.isEmpty
              ? 'your operational area'
              : (areaRaw.length <= 80 ? areaRaw : areaRaw.substring(0, 80)),
      issuedAt: issuedAt,
      expiresAt: DateTime.tryParse(data['expiresAt']?.toString() ?? ''),
      distanceMeters: int.tryParse(data['distanceMeters']?.toString() ?? ''),
    );
    return value.expired ? null : value;
  }
}
