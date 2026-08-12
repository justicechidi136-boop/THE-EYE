import "../broadcasts/broadcast_navigation.dart";
import "notification_inbox_service.dart";

/// Resolves the in-app route for an inbox notification tap.
///
/// Broadcast alerts sometimes arrive with a generic `/broadcasts` deep link
/// (or only `broadcastId` populated). Prefer the concrete detail route so
/// notification → Broadcast Detail does not land on an empty center screen
/// or a detail page with a missing/invalid id.
String resolveInboxNotificationDestination(InboxNotificationItem alert) {
  final deepLink = alert.deepLink?.trim();
  final broadcastId = alert.broadcastId?.trim();
  final detailRoute =
      broadcastId != null && broadcastId.isNotEmpty ? broadcastDetailRoute(broadcastId) : null;

  if (detailRoute != null) {
    if (deepLink == null ||
        deepLink.isEmpty ||
        deepLink == "/notifications" ||
        deepLink == BroadcastRoutes.center) {
      return detailRoute;
    }
  }

  if (deepLink != null && deepLink.isNotEmpty) return deepLink;
  return "/notifications";
}
