import "push_deep_link_router.dart";

class PushNavigationRequest {
  const PushNavigationRequest({
    required this.route,
    this.incidentId,
    this.silent = false,
  });

  final String route;
  final String? incidentId;
  final bool silent;

  static PushNavigationRequest? fromMessageData(Map<String, dynamic> data) {
    final rawRoute = data["route"] ?? data["deepLink"] ?? data["deep_link"];
    if (rawRoute != null) {
      final trimmed = rawRoute.toString().trim();
      if (!trimmed.startsWith("/") || trimmed.contains("..") || trimmed.contains("://")) {
        return null;
      }
    }
    final route = PushDeepLinkRouter.resolveRoute(data);
    if (route == null || !PushDeepLinkRouter.allowedRoutes.contains(route)) {
      return null;
    }
    final incidentId = data["incidentId"]?.toString();
    final silent = data["silent"]?.toString().toLowerCase() == "true";
    return PushNavigationRequest(route: route, incidentId: incidentId, silent: silent);
  }
}
