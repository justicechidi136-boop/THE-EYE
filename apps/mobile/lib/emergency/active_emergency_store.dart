import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "active_emergency_contract.dart";

class ActiveIncidentReference {
  const ActiveIncidentReference({
    required this.incidentId,
    required this.activatedAt,
    this.lastKnownStatus,
    this.statusVersion,
    this.lastRefreshedAt,
    this.silent = false,
  });

  final String incidentId;
  final DateTime activatedAt;
  final String? lastKnownStatus;
  final int? statusVersion;
  final DateTime? lastRefreshedAt;
  final bool silent;

  ActiveIncidentReference copyWith({
    String? lastKnownStatus,
    int? statusVersion,
    DateTime? lastRefreshedAt,
    bool? silent,
  }) {
    return ActiveIncidentReference(
      incidentId: incidentId,
      activatedAt: activatedAt,
      lastKnownStatus: lastKnownStatus ?? this.lastKnownStatus,
      statusVersion: statusVersion ?? this.statusVersion,
      lastRefreshedAt: lastRefreshedAt ?? this.lastRefreshedAt,
      silent: silent ?? this.silent,
    );
  }

  Map<String, dynamic> toJson() => {
        "incidentId": incidentId,
        "activatedAt": activatedAt.toIso8601String(),
        if (lastKnownStatus != null) "lastKnownStatus": lastKnownStatus,
        if (statusVersion != null) "statusVersion": statusVersion,
        if (lastRefreshedAt != null)
          "lastRefreshedAt": lastRefreshedAt!.toIso8601String(),
        "silent": silent,
      };

  factory ActiveIncidentReference.fromJson(Map<String, dynamic> json) {
    return ActiveIncidentReference(
      incidentId: json["incidentId"]?.toString() ?? "",
      activatedAt: DateTime.tryParse(json["activatedAt"]?.toString() ?? "") ??
          DateTime.now().toUtc(),
      lastKnownStatus: json["lastKnownStatus"]?.toString(),
      statusVersion: json["statusVersion"] is num
          ? (json["statusVersion"] as num).toInt()
          : null,
      lastRefreshedAt:
          DateTime.tryParse(json["lastRefreshedAt"]?.toString() ?? ""),
      silent: json["silent"] == true,
    );
  }
}

class ActiveEmergencyStore {
  static const _referencesKey = "the_eye_active_emergency_references_v2";
  static const _lastOpenedKey = "the_eye_active_emergency_last_opened";
  static const _legacyIncidentKey = "the_eye_active_emergency_incident_id";
  static const _legacySilentKey = "the_eye_active_emergency_silent";

  Future<List<ActiveIncidentReference>> readReferences() async {
    final prefs = await SharedPreferences.getInstance();
    await _migrateLegacyReference(prefs);
    final raw = prefs.getString(_referencesKey);
    if (raw == null || raw.isEmpty) return const [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(ActiveIncidentReference.fromJson)
        .where((ref) => ref.incidentId.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> saveReferences(List<ActiveIncidentReference> references) async {
    final prefs = await SharedPreferences.getInstance();
    final payload =
        references.map((ref) => ref.toJson()).toList(growable: false);
    await prefs.setString(_referencesKey, jsonEncode(payload));
  }

  Future<void> activateIncident(
    String incidentId, {
    bool silent = false,
  }) async {
    if (incidentId.isEmpty) return;
    final existing = await readReferences();
    final now = DateTime.now().toUtc();
    final withoutDuplicate = existing
        .where((ref) => ref.incidentId != incidentId)
        .toList(growable: true);
    withoutDuplicate.insert(
      0,
      ActiveIncidentReference(
        incidentId: incidentId,
        activatedAt: now,
        silent: silent,
        lastRefreshedAt: now,
      ),
    );
    await saveReferences(withoutDuplicate);
    await setLastOpenedIncidentId(incidentId);
  }

  Future<void> updateReference(ActiveIncidentReference reference) async {
    final existing = await readReferences();
    final updated = existing
        .map((ref) => ref.incidentId == reference.incidentId ? reference : ref)
        .toList(growable: false);
    await saveReferences(updated);
  }

  Future<void> removeIncident(String incidentId) async {
    final existing = await readReferences();
    await saveReferences(
      existing
          .where((ref) => ref.incidentId != incidentId)
          .toList(growable: false),
    );
    final lastOpened = await readLastOpenedIncidentId();
    if (lastOpened == incidentId) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_lastOpenedKey);
    }
  }

  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_referencesKey);
    await prefs.remove(_lastOpenedKey);
    await prefs.remove(_legacyIncidentKey);
    await prefs.remove(_legacySilentKey);
  }

  Future<String?> readLastOpenedIncidentId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_lastOpenedKey);
  }

  Future<void> setLastOpenedIncidentId(String incidentId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastOpenedKey, incidentId);
  }

  Future<String?> readActiveIncidentId() async {
    final refs = await readReferences();
    if (refs.isEmpty) return null;
    if (refs.length == 1) return refs.first.incidentId;
    return await readLastOpenedIncidentId() ?? refs.first.incidentId;
  }

  Future<bool> readSilentModeFor(String incidentId) async {
    final refs = await readReferences();
    for (final ref in refs) {
      if (ref.incidentId == incidentId) return ref.silent;
    }
    return false;
  }

  Future<void> _migrateLegacyReference(SharedPreferences prefs) async {
    final legacyId = prefs.getString(_legacyIncidentKey);
    if (legacyId == null || legacyId.isEmpty) return;
    final silent = prefs.getBool(_legacySilentKey) ?? false;
    await activateIncident(legacyId, silent: silent);
    await prefs.remove(_legacyIncidentKey);
    await prefs.remove(_legacySilentKey);
  }
}

// Legacy snapshot retained for tests and gradual migration.
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
    this.contract,
    this.publicReference,
    this.reportedAt,
    this.unreadUpdatesCount = 0,
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
  final ActiveEmergencyContract? contract;
  final String? publicReference;
  final DateTime? reportedAt;
  final int unreadUpdatesCount;

  factory ActiveEmergencySnapshot.fromContract(
    ActiveEmergencyContract contract, {
    bool silent = false,
  }) {
    if (contract is ActiveEmergencyActiveContract) {
      return ActiveEmergencySnapshot(
        incidentId: contract.incidentId,
        status: contract.status,
        title: contract.title,
        type: contract.category,
        agencyName: contract.assignedAgencyName ??
            contract.assignment?.agencyName ??
            "",
        timeline: contract.timelineSummary
            .map((entry) => {
                  "id": entry.id,
                  "eventType": entry.eventType,
                  "message": entry.message,
                  "createdAt": entry.createdAt.toIso8601String(),
                })
            .toList(growable: false),
        silent: silent,
        contract: contract,
        publicReference: contract.publicReference,
        reportedAt: contract.reportedAt,
        unreadUpdatesCount: contract.communication.unreadMessageCount,
      );
    }
    final terminal = contract as ActiveEmergencyTerminalContract;
    return ActiveEmergencySnapshot(
      incidentId: terminal.incidentId,
      status: terminal.status,
      title: terminal.displayLabel,
      type: terminal.status,
      agencyName: "",
      timeline: const [],
      silent: silent,
      contract: terminal,
      publicReference: terminal.publicReference,
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
