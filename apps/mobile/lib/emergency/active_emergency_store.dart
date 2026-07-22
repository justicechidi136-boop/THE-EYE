import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

class ActiveEmergencyStore {
  static const _activeIncidentKey = "the_eye_active_emergency_incident_id";
  static const _silentKey = "the_eye_active_emergency_silent";

  Future<void> saveActiveIncident(String incidentId,
      {bool silent = false}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_activeIncidentKey, incidentId);
    await prefs.setBool(_silentKey, silent);
  }

  Future<String?> readActiveIncidentId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_activeIncidentKey);
  }

  Future<bool> readSilentMode() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_silentKey) ?? false;
  }

  Future<void> clearActiveIncident() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_activeIncidentKey);
    await prefs.remove(_silentKey);
  }
}

class ActiveEmergencySnapshot {
  const ActiveEmergencySnapshot({
    required this.incidentId,
    required this.status,
    required this.title,
    required this.type,
    required this.agencyName,
    required this.timeline,
    this.lastLocationAt,
    this.distanceMeters,
    this.distanceSource,
    this.etaLabel,
    this.silent = false,
  });

  final String incidentId;
  final String status;
  final String title;
  final String type;
  final String agencyName;
  final List<Map<String, dynamic>> timeline;
  final DateTime? lastLocationAt;
  final double? distanceMeters;
  final String? distanceSource;
  final String? etaLabel;
  final bool silent;

  factory ActiveEmergencySnapshot.fromJson(Map<String, dynamic> json,
      {bool silent = false}) {
    final metadata = json["metadata"] as Map<String, dynamic>? ?? {};
    final silentFromServer = metadata["silent"] == true;
    final timeline = (json["timeline"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
    return ActiveEmergencySnapshot(
      incidentId: json["id"]?.toString() ?? "",
      status: json["status"]?.toString() ?? "Submitted",
      title: json["title"]?.toString() ?? "Emergency",
      type: json["type"]?.toString() ?? "SOS",
      agencyName: (json["assignedAgency"] as Map<String, dynamic>?)?["name"]
              ?.toString() ??
          "",
      timeline: timeline,
      silent: silent || silentFromServer,
    );
  }
}

String timelineEntryLabel(Map<String, dynamic> entry) {
  return entry["label"]?.toString() ??
      entry["message"]?.toString() ??
      entry["eventType"]?.toString() ??
      entry["type"]?.toString() ??
      "Update";
}

String encodeSnapshot(ActiveEmergencySnapshot snapshot) => jsonEncode({
      "incidentId": snapshot.incidentId,
      "status": snapshot.status,
      "title": snapshot.title,
      "type": snapshot.type,
      "agencyName": snapshot.agencyName,
      "silent": snapshot.silent,
    });
