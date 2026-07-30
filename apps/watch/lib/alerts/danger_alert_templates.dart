import 'danger_alert_models.dart';

typedef DangerAlertTemplateParams = ({
  String? areaName,
  int? distanceMeters,
});

abstract final class DangerAlertTemplates {
  static String resolve({
    required String alertCode,
    required String languageCode,
    DangerAlertTemplateParams params = (areaName: null, distanceMeters: null),
  }) {
    final area = _safeArea(params.areaName);
    final distance = _safeDistance(params.distanceMeters);

    final languageTemplates = _templates[languageCode] ?? _templates[SpokenLanguageCodes.english]!;
    final template = languageTemplates[alertCode] ?? languageTemplates[DangerAlertCodes.generalEntry]!;

    return template
        .replaceAll('{area}', area)
        .replaceAll('{distance}', distance);
  }

  static String _safeArea(String? value) {
    if (value == null || value.trim().isEmpty) return 'your area';
    return value.trim();
  }

  static String _safeDistance(int? meters) {
    if (meters == null || meters <= 0) return 'nearby';
    if (meters >= 1000) {
      final km = (meters / 1000).toStringAsFixed(1);
      return 'about $km kilometres away';
    }
    return 'about $meters metres away';
  }

  static const Map<String, Map<String, String>> _templates = {
    SpokenLanguageCodes.english: {
      DangerAlertCodes.armedRobberyNearby:
          'Warning. An armed robbery has been reported near {area}, {distance}. Avoid the area.',
      DangerAlertCodes.kidnappingNearby:
          'Warning. A kidnapping has been reported near {area}, {distance}. Stay alert and avoid the area.',
      DangerAlertCodes.violentAttackNearby:
          'Warning. A violent attack has been reported near {area}, {distance}. Move to safety.',
      DangerAlertCodes.activeShooterNearby:
          'Critical warning. An active shooter or armed threat has been reported near {area}, {distance}. Seek cover immediately.',
      DangerAlertCodes.communalViolenceNearby:
          'Warning. Communal violence has been reported near {area}, {distance}. Avoid the area.',
      DangerAlertCodes.terroristThreatNearby:
          'Critical warning. A terrorist threat has been reported near {area}, {distance}. Leave the area immediately.',
      DangerAlertCodes.fireNearby:
          'Warning. A fire has been reported near {area}, {distance}. Avoid smoke and stay clear.',
      DangerAlertCodes.floodNearby:
          'Warning. Flooding has been reported near {area}, {distance}. Move to higher ground.',
      DangerAlertCodes.gasLeakNearby:
          'Warning. A gas leak has been reported near {area}, {distance}. Leave the area immediately.',
      DangerAlertCodes.hazardousAreaNearby:
          'Warning. A hazardous area has been reported near {area}, {distance}. Do not enter.',
      DangerAlertCodes.roadDangerNearby:
          'Warning. Road danger has been reported near {area}, {distance}. Use an alternate route.',
      DangerAlertCodes.buildingCollapseNearby:
          'Warning. A building collapse has been reported near {area}, {distance}. Stay away from the structure.',
      DangerAlertCodes.civilDisturbanceNearby:
          'Warning. Civil disturbance near {area}, {distance}. Avoid crowds and stay alert.',
      DangerAlertCodes.policeAdvisoryNearby:
          'Police safety advisory for {area}, {distance}. Follow official guidance.',
      DangerAlertCodes.missingChildNearby:
          'Missing child alert near {area}, {distance}. Stay alert and report sightings to authorities.',
      DangerAlertCodes.evacuationNearby:
          'Evacuation warning for {area}, {distance}. Leave the area using safe routes.',
      DangerAlertCodes.generalEntry:
          'Warning. You are entering a reported danger zone near {area}, {distance}. Avoid the area.',
      DangerAlertCodes.proximityIncrease:
          'Alert. You are getting closer to a reported danger near {area}, {distance}. Turn away if possible.',
      DangerAlertCodes.cleared:
          'Update. The danger zone near {area} has been cleared. Stay aware of your surroundings.',
    },
    SpokenLanguageCodes.nigerianPidgin: {
      DangerAlertCodes.armedRobberyNearby:
          'Danger. Dem report armed robbery near {area}, {distance}. Abeg avoid that place.',
      DangerAlertCodes.kidnappingNearby:
          'Danger. Kidnapping dey reported near {area}, {distance}. Shine your eye and avoid that area.',
      DangerAlertCodes.violentAttackNearby:
          'Danger. Violent attack don happen near {area}, {distance}. Move go safe place now.',
      DangerAlertCodes.activeShooterNearby:
          'Critical warning. Active shooter or armed threat dey near {area}, {distance}. Find cover immediately.',
      DangerAlertCodes.communalViolenceNearby:
          'Danger. Communal violence dey near {area}, {distance}. No enter that area.',
      DangerAlertCodes.terroristThreatNearby:
          'Critical warning. Terrorist threat dey near {area}, {distance}. Comot from that area sharp sharp.',
      DangerAlertCodes.fireNearby:
          'Warning. Fire dey near {area}, {distance}. Avoid smoke and stay far.',
      DangerAlertCodes.floodNearby:
          'Warning. Flood dey near {area}, {distance}. Move go higher ground.',
      DangerAlertCodes.gasLeakNearby:
          'Danger. Gas leak dey near {area}, {distance}. Leave that area immediately.',
      DangerAlertCodes.hazardousAreaNearby:
          'Warning. Hazardous area dey near {area}, {distance}. No enter.',
      DangerAlertCodes.roadDangerNearby:
          'Warning. Road danger dey near {area}, {distance}. Use another route.',
      DangerAlertCodes.buildingCollapseNearby:
          'Warning. Building collapse near {area}, {distance}. Stay away from the building.',
      DangerAlertCodes.civilDisturbanceNearby:
          'Warning. Civil disturbance dey near {area}, {distance}. Avoid crowd.',
      DangerAlertCodes.policeAdvisoryNearby:
          'Police advisory for {area}, {distance}. Follow official guidance.',
      DangerAlertCodes.missingChildNearby:
          'Missing pikin alert near {area}, {distance}. Report any sighting to authorities.',
      DangerAlertCodes.evacuationNearby:
          'Evacuation warning for {area}, {distance}. Comot from that area safely.',
      DangerAlertCodes.generalEntry:
          'Warning. You dey enter danger zone near {area}, {distance}. Avoid that area.',
      DangerAlertCodes.proximityIncrease:
          'Alert. You dey move closer to danger near {area}, {distance}. Turn back if you fit.',
      DangerAlertCodes.cleared:
          'Update. Danger zone near {area} don clear. Still dey alert.',
    },
  };
}

/// Short on-screen labels (English) for accessibility.
abstract final class DangerAlertDisplayLabels {
  static String titleFor(String alertCode) {
    return switch (alertCode) {
      DangerAlertCodes.cleared => 'Area Cleared',
      DangerAlertCodes.proximityIncrease => 'Getting Closer',
      DangerAlertCodes.activeShooterNearby ||
      DangerAlertCodes.terroristThreatNearby =>
        'CRITICAL DANGER',
      _ => 'DANGER ALERT',
    };
  }

  static String subtitleFor(DangerAlertPayload payload) {
    final parts = <String>[];
    if (payload.areaName != null && payload.areaName!.isNotEmpty) {
      parts.add(payload.areaName!);
    }
    if (payload.distanceMeters != null) {
      parts.add('~${payload.distanceMeters} m');
    }
    return parts.isEmpty ? 'Stay alert' : parts.join(' · ');
  }
}
