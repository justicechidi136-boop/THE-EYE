import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

class StolenVehicleBroadcastDraft {
  const StolenVehicleBroadcastDraft({
    this.entryMode,
    this.selectedVehicleId,
    this.usedSavedVehicle = false,
    this.plateNumber,
    this.make,
    this.model,
    this.year,
    this.color,
    this.vin,
    this.description,
    this.theftDescription,
    this.lastKnownLocation,
    this.lastSeenAt,
    this.updatedAt,
  });

  final String? entryMode;
  final String? selectedVehicleId;
  final bool usedSavedVehicle;
  final String? plateNumber;
  final String? make;
  final String? model;
  final String? year;
  final String? color;
  final String? vin;
  final String? description;
  final String? theftDescription;
  final String? lastKnownLocation;
  final DateTime? lastSeenAt;
  final DateTime? updatedAt;

  Map<String, dynamic> toJson() => {
        if (entryMode != null) "entryMode": entryMode,
        if (selectedVehicleId != null) "selectedVehicleId": selectedVehicleId,
        "usedSavedVehicle": usedSavedVehicle,
        if (plateNumber != null) "plateNumber": plateNumber,
        if (make != null) "make": make,
        if (model != null) "model": model,
        if (year != null) "year": year,
        if (color != null) "color": color,
        if (vin != null) "vin": vin,
        if (description != null) "description": description,
        if (theftDescription != null) "theftDescription": theftDescription,
        if (lastKnownLocation != null) "lastKnownLocation": lastKnownLocation,
        if (lastSeenAt != null) "lastSeenAt": lastSeenAt!.toIso8601String(),
        if (updatedAt != null) "updatedAt": updatedAt!.toIso8601String(),
      };

  factory StolenVehicleBroadcastDraft.fromJson(Map<String, dynamic> json) {
    return StolenVehicleBroadcastDraft(
      entryMode: json["entryMode"] as String?,
      selectedVehicleId: json["selectedVehicleId"] as String?,
      usedSavedVehicle: json["usedSavedVehicle"] == true,
      plateNumber: json["plateNumber"] as String?,
      make: json["make"] as String?,
      model: json["model"] as String?,
      year: json["year"] as String?,
      color: json["color"] as String?,
      vin: json["vin"] as String?,
      description: json["description"] as String?,
      theftDescription: json["theftDescription"] as String?,
      lastKnownLocation: json["lastKnownLocation"] as String?,
      lastSeenAt: DateTime.tryParse((json["lastSeenAt"] as String?) ?? ""),
      updatedAt: DateTime.tryParse((json["updatedAt"] as String?) ?? ""),
    );
  }
}

class StolenVehicleBroadcastDraftStore {
  StolenVehicleBroadcastDraftStore({SharedPreferences? preferences})
      : _preferencesFuture = preferences != null
            ? Future.value(preferences)
            : SharedPreferences.getInstance();

  final Future<SharedPreferences> _preferencesFuture;

  static String storageKey(String userScope) =>
      "stolen_vehicle_broadcast_draft_v1:$userScope";

  Future<StolenVehicleBroadcastDraft?> load({
    required String userScope,
  }) async {
    final prefs = await _preferencesFuture;
    final raw = prefs.getString(storageKey(userScope));
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return StolenVehicleBroadcastDraft.fromJson(
        Map<String, dynamic>.from(decoded),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> save({
    required String userScope,
    required StolenVehicleBroadcastDraft draft,
  }) async {
    final prefs = await _preferencesFuture;
    await prefs.setString(storageKey(userScope), jsonEncode(draft.toJson()));
  }

  Future<void> clear({
    required String userScope,
  }) async {
    final prefs = await _preferencesFuture;
    await prefs.remove(storageKey(userScope));
  }
}
