import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

class BroadcastSightingDraft {
  const BroadcastSightingDraft({
    required this.broadcastId,
    required this.clientActionId,
    required this.description,
    this.observedAt,
    this.latitude,
    this.longitude,
    this.approximateArea,
    this.directionOfTravel,
    this.confidence,
    this.anonymousToReviewers = false,
    this.photoReference,
    this.videoReference,
    this.voiceReference,
    this.updatedAt,
  });

  final String broadcastId;
  final String clientActionId;
  final String description;
  final String? observedAt;
  final double? latitude;
  final double? longitude;
  final String? approximateArea;
  final String? directionOfTravel;
  final String? confidence;
  final bool anonymousToReviewers;
  final String? photoReference;
  final String? videoReference;
  final String? voiceReference;
  final DateTime? updatedAt;

  Map<String, dynamic> toJson() => {
        "broadcastId": broadcastId,
        "clientActionId": clientActionId,
        "description": description,
        if (observedAt != null) "observedAt": observedAt,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
        if (approximateArea != null) "approximateArea": approximateArea,
        if (directionOfTravel != null) "directionOfTravel": directionOfTravel,
        if (confidence != null) "confidence": confidence,
        "anonymousToReviewers": anonymousToReviewers,
        if (photoReference != null) "photoReference": photoReference,
        if (videoReference != null) "videoReference": videoReference,
        if (voiceReference != null) "voiceReference": voiceReference,
        if (updatedAt != null) "updatedAt": updatedAt!.toIso8601String(),
      };

  factory BroadcastSightingDraft.fromJson(Map<String, dynamic> json) {
    return BroadcastSightingDraft(
      broadcastId: (json["broadcastId"] as String?) ?? "",
      clientActionId: (json["clientActionId"] as String?) ?? "",
      description: (json["description"] as String?) ?? "",
      observedAt: json["observedAt"] as String?,
      latitude: (json["latitude"] as num?)?.toDouble(),
      longitude: (json["longitude"] as num?)?.toDouble(),
      approximateArea: json["approximateArea"] as String?,
      directionOfTravel: json["directionOfTravel"] as String?,
      confidence: json["confidence"] as String?,
      anonymousToReviewers: json["anonymousToReviewers"] == true,
      photoReference: json["photoReference"] as String?,
      videoReference: json["videoReference"] as String?,
      voiceReference: json["voiceReference"] as String?,
      updatedAt: DateTime.tryParse((json["updatedAt"] as String?) ?? ""),
    );
  }
}

class BroadcastSightingDraftStore {
  BroadcastSightingDraftStore({SharedPreferences? preferences})
      : _preferencesFuture = preferences != null
            ? Future.value(preferences)
            : SharedPreferences.getInstance();

  final Future<SharedPreferences> _preferencesFuture;

  static String storageKey(String userScope, String broadcastId) =>
      "broadcast_sighting_draft_v1:$userScope:$broadcastId";

  Future<BroadcastSightingDraft?> load({
    required String userScope,
    required String broadcastId,
  }) async {
    final prefs = await _preferencesFuture;
    final raw = prefs.getString(storageKey(userScope, broadcastId));
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return BroadcastSightingDraft.fromJson(
          Map<String, dynamic>.from(decoded));
    } catch (_) {
      return null;
    }
  }

  Future<void> save({
    required String userScope,
    required BroadcastSightingDraft draft,
  }) async {
    final prefs = await _preferencesFuture;
    await prefs.setString(
      storageKey(userScope, draft.broadcastId),
      jsonEncode(draft.toJson()),
    );
  }

  Future<void> clear({
    required String userScope,
    required String broadcastId,
  }) async {
    final prefs = await _preferencesFuture;
    await prefs.remove(storageKey(userScope, broadcastId));
  }
}
