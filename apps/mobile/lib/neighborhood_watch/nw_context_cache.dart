import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "neighborhood_watch_service.dart";

class CachedNwContext {
  const CachedNwContext({
    required this.context,
    required this.cachedAt,
  });

  final NwContextResponse context;
  final DateTime cachedAt;
}

class NwContextCache {
  NwContextCache({SharedPreferences? preferences})
      : _preferencesFuture = preferences != null
            ? Future.value(preferences)
            : SharedPreferences.getInstance();

  final Future<SharedPreferences> _preferencesFuture;

  String _cacheKey(String userScope) => "nw_context_cache_v1:$userScope";

  Future<void> save(String userScope, NwContextResponse context) async {
    final prefs = await _preferencesFuture;
    await prefs.setString(
      _cacheKey(userScope),
      jsonEncode({
        "cachedAt": DateTime.now().toUtc().toIso8601String(),
        "context": context.toJson(),
      }),
    );
  }

  Future<CachedNwContext?> load(String userScope) async {
    final prefs = await _preferencesFuture;
    final raw = prefs.getString(_cacheKey(userScope));
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    final cachedAtRaw = decoded["cachedAt"] as String?;
    final contextRaw = decoded["context"];
    if (cachedAtRaw == null || contextRaw is! Map) return null;
    final cachedAt = DateTime.tryParse(cachedAtRaw);
    if (cachedAt == null) return null;
    return CachedNwContext(
      context: NwContextResponse.fromJson(
        Map<String, dynamic>.from(contextRaw),
      ),
      cachedAt: cachedAt,
    );
  }

  Future<void> clear(String userScope) async {
    final prefs = await _preferencesFuture;
    await prefs.remove(_cacheKey(userScope));
  }
}

String formatNwContextCachedAt(DateTime cachedAt) {
  final local = cachedAt.toLocal();
  final hour = local.hour.toString().padLeft(2, "0");
  final minute = local.minute.toString().padLeft(2, "0");
  return "${local.year}-${local.month.toString().padLeft(2, "0")}-${local.day.toString().padLeft(2, "0")} $hour:$minute";
}

String nwContextStaleBannerMessage(DateTime cachedAt) {
  return "STALE — showing saved context from ${formatNwContextCachedAt(cachedAt)}. Refresh for current GPS.";
}

/// Cached context must never be shown as a live GPS fix.
NwContextResponse stripLivePresence(NwContextResponse context) {
  return NwContextResponse(
    locationStatus: context.locationStatus,
    contextType: context.contextType,
    publicCommunity: context.publicCommunity,
    dynamicArea: context.dynamicArea,
    presence: null,
    homeCommunity: context.homeCommunity,
    privateCommunitiesNearby: context.privateCommunitiesNearby,
    permissions: context.permissions.copyWithRestrictedActions(),
    safetySummary: context.safetySummary,
  );
}
