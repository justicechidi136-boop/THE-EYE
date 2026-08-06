import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "activity_history_service.dart";

class ActivityHistoryCache {
  static const _cacheKey = "the_eye.activity_history.v1";

  Future<void> save({
    required String scope,
    required String section,
    required List<ActivityHistoryItem> items,
    String? nextCursor,
    bool hasMore = false,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _cacheKey,
      jsonEncode({
        "scope": scope,
        "section": section,
        "savedAt": DateTime.now().toIso8601String(),
        "nextCursor": nextCursor,
        "hasMore": hasMore,
        "items": items
            .map(
              (item) => {
                "sourceType": item.sourceType,
                "kind": item.kind,
                "id": item.id,
                "category": item.category,
                "status": item.status,
                "lifecycle": item.lifecycle,
                "statusBadge": item.statusBadge,
                "occurredAt": item.occurredAt,
                "dateLabel": item.dateLabel,
                "timeLabel": item.timeLabel,
                "location": {"address": item.locationAddress},
                "agency": item.agency,
                "verificationConfidence": item.verificationConfidence,
                "verificationStatus": item.verificationStatus,
                "broadcastReach": item.broadcastReach,
                "latestUpdate": item.latestUpdateLabel == null
                    ? null
                    : {"label": item.latestUpdateLabel, "at": item.latestUpdateAt},
                "unreadUpdatesCount": item.unreadUpdatesCount,
                "thumbnail": item.thumbnailMediaType == null
                    ? null
                    : {"mediaType": item.thumbnailMediaType},
                "timelinePreview": item.timelinePreview
                    .map((entry) => {"label": entry.label, "at": entry.at, "type": entry.type})
                    .toList(),
                "navigation": {
                  "destination": item.navigation.destination,
                  "incidentId": item.navigation.incidentId,
                  "broadcastId": item.navigation.broadcastId,
                },
                "isActive": item.isActive,
                "isTerminal": item.isTerminal,
                "title": item.title,
                "missingPersonName": item.missingPersonName,
                "vehiclePlate": item.vehiclePlate,
              },
            )
            .toList(),
      }),
    );
  }

  Future<ActivityHistoryPage?> load({
    required String scope,
    required String section,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey);
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    final map = Map<String, dynamic>.from(decoded);
    if (map["scope"]?.toString() != scope) return null;
    if (map["section"]?.toString() != section) return null;
    final rows = map["items"];
    if (rows is! List) return null;
    final items = rows
        .whereType<Map>()
        .map((row) => ActivityHistoryItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
    return ActivityHistoryPage(
      items: items,
      hasMore: map["hasMore"] == true,
      nextCursor: map["nextCursor"]?.toString(),
    );
  }
}
