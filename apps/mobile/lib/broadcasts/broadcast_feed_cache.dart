import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "broadcast_feed_service.dart";

class BroadcastFeedCache {
  BroadcastFeedCache({SharedPreferences? preferences})
      : _preferencesFuture = preferences != null
            ? Future.value(preferences)
            : SharedPreferences.getInstance();

  final Future<SharedPreferences> _preferencesFuture;

  String _cacheKey(String userScope) => "broadcast_feed_cache_v1:$userScope";

  Future<void> save(String userScope, List<BroadcastFeedItem> items) async {
    final prefs = await _preferencesFuture;
    final encoded = items
        .map(
          (item) => {
            "id": item.id,
            "type": item.type,
            "title": item.title,
            "body": item.body,
            "priority": item.priority,
            "read": item.read,
            "publishedAt": item.publishedAt?.toIso8601String(),
            "expiresAt": item.expiresAt?.toIso8601String(),
            "expired": item.expired,
            "distanceMeters": item.distanceMeters,
            "deepLink": item.deepLink,
          },
        )
        .toList();
    await prefs.setString(_cacheKey(userScope), jsonEncode(encoded));
  }

  Future<List<BroadcastFeedItem>> load(String userScope) async {
    final prefs = await _preferencesFuture;
    final raw = prefs.getString(_cacheKey(userScope));
    if (raw == null || raw.isEmpty) return const [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map>()
        .map(
            (row) => BroadcastFeedItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> clear(String userScope) async {
    final prefs = await _preferencesFuture;
    await prefs.remove(_cacheKey(userScope));
  }
}
