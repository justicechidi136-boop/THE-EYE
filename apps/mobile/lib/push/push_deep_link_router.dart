import "notification_routing.dart";

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
    "/active-emergency",
    "/active-emergencies",
    "/incident-detail",
    "/community-verification",
    "/support",
    "/support/chats",
    "/support/conversation",
    "/support/new",
  };

  static bool isAllowedDestination(String route) {
    if (allowedRoutes.contains(route)) return true;
    if (route.startsWith("/broadcasts/") && route.length > "/broadcasts/".length) {
      return true;
    }
    if (route.startsWith("/active-emergency/") && route.endsWith("/messages")) {
      return route.length > "/active-emergency/".length + "/messages".length;
    }
    if (route.startsWith("/incident-detail/") && route.endsWith("/messages")) {
      return route.length > "/incident-detail/".length + "/messages".length;
    }
    return route.startsWith("/community-verification/") &&
        route.length > "/community-verification/".length;
  }

  /// Returns a safe in-app route from FCM data payload fields.
  static String? resolveRoute(Map<String, dynamic> data) {
    final routing = PushNotificationRouting.fromMessageData(data);
    if (routing != null && isAllowedDestination(routing.destination)) {
      return routing.destination;
    }

    final explicitRoute =
        _sanitize(data["route"] ?? data["deepLink"] ?? data["deep_link"]);
    if (explicitRoute != null) {
      if (isAllowedDestination(explicitRoute)) return explicitRoute;
    }

    final type = (data["type"] ?? "").toString().toLowerCase();
    if (type.contains("emergency") || type.contains("sos"))
      return "/report/emergency";
    if (type.contains("missingperson")) return "/missing-person";
    if (type.contains("stolenvehicle")) return "/stolen-vehicle";
    if (type.contains("neighborhood") || type.contains("communitywatch"))
      return "/neighborhood-watch";
    if (type.contains("nearbyincidentverification") ||
        data["verificationRequestId"] != null) {
      final requestId = data["verificationRequestId"]?.toString();
      if (requestId != null && requestId.isNotEmpty) {
        return "/community-verification/$requestId";
      }
    }
    if (type.contains("incident")) return "/active-emergency";
    if (type.contains("broadcast")) return "/broadcasts";
    if (type.contains("livevideo")) return "/live-video";
    if (type.contains("support")) return "/support/chats";
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
