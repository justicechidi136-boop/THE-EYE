import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "notification_inbox_service.dart";

class NotificationInboxCache {
  NotificationInboxCache({SharedPreferences? preferences})
      : _preferencesFuture = preferences != null
            ? Future.value(preferences)
            : SharedPreferences.getInstance();

  final Future<SharedPreferences> _preferencesFuture;

  String _cacheKey(String userId) => "notification_inbox_cache_v1:$userId";

  Future<void> save(String userId, List<InboxNotificationItem> items) async {
    final prefs = await _preferencesFuture;
    final encoded = items
        .map(
          (item) => {
            "id": item.id,
            "type": item.type,
            "title": item.title,
            "body": item.body,
            "priority": item.priority,
            "deliveryStatus": item.deliveryStatus,
            "read": item.read,
            "createdAt": item.createdAt.toIso8601String(),
            "deepLink": item.deepLink,
            "incidentId": item.incidentId,
            "broadcastId": item.broadcastId,
            "expired": item.expired,
          },
        )
        .toList();
    await prefs.setString(_cacheKey(userId), jsonEncode(encoded));
  }

  Future<List<InboxNotificationItem>> load(String userId) async {
    final prefs = await _preferencesFuture;
    final raw = prefs.getString(_cacheKey(userId));
    if (raw == null || raw.isEmpty) return const [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map>()
        .map((row) =>
            InboxNotificationItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> clear(String userId) async {
    final prefs = await _preferencesFuture;
    await prefs.remove(_cacheKey(userId));
  }

  Future<void> clearAll() async {
    final prefs = await _preferencesFuture;
    final keys = prefs
        .getKeys()
        .where((key) => key.startsWith("notification_inbox_cache_v1:"))
        .toList();
    for (final key in keys) {
      await prefs.remove(key);
    }
  }
}
