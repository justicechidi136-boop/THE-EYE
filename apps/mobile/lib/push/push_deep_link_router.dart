abstract final class PushDeepLinkRouter {
  static const allowedRoutes = <String>{
    "/home",
    "/notifications",
    "/broadcasts",
    "/tracking",
    "/missing-person",
    "/stolen-vehicle",
    "/neighborhood-watch",
    "/neighborhood-watch/alerts",
    "/live-video",
    "/report/emergency",
  };

  /// Returns a safe in-app route from FCM data payload fields.
  static String? resolveRoute(Map<String, dynamic> data) {
    final explicitRoute =
        _sanitize(data["route"] ?? data["deepLink"] ?? data["deep_link"]);
    if (explicitRoute != null && allowedRoutes.contains(explicitRoute)) {
      return explicitRoute;
    }

    final type = (data["type"] ?? "").toString().toLowerCase();
    if (type.contains("emergency") || type.contains("sos"))
      return "/report/emergency";
    if (type.contains("missingperson")) return "/missing-person";
    if (type.contains("stolenvehicle")) return "/stolen-vehicle";
    if (type.contains("neighborhood") || type.contains("community"))
      return "/neighborhood-watch";
    if (type.contains("incident")) return "/tracking";
    if (type.contains("broadcast")) return "/broadcasts";
    if (type.contains("livevideo")) return "/live-video";
    return "/notifications";
  }

  static String? _sanitize(Object? value) {
    if (value is! String) return null;
    final trimmed = value.trim();
    if (!trimmed.startsWith("/")) return null;
    if (trimmed.contains("..")) return null;
    if (trimmed.contains("://")) return null;
    return trimmed.split("?").first;
  }
}
