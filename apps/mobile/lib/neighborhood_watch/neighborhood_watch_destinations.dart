/// In-app routes for Neighborhood Watch navigation and deep links.

abstract final class NeighborhoodWatchDestinations {
  static const home = "/neighborhood-watch";

  static const feed = "/neighborhood-watch/feed";

  static const alerts = "/neighborhood-watch/alerts";

  static const patrols = "/neighborhood-watch/patrols";

  static const communities = "/neighborhood-watch/communities";

  static const join = "/neighborhood-watch/join";

  static const requestCommunity = "/neighborhood-watch/request-community";

  static const create = "/neighborhood-watch/create";

  static const members = "/neighborhood-watch/members";

  static const map = "/neighborhood-watch/map";

  static const chat = "/neighborhood-watch/chat";

  static const volunteers = "/neighborhood-watch/volunteers";

  static const _postPrefix = "/neighborhood-watch/post/";

  static const _patrolPrefix = "/neighborhood-watch/patrol/";

  static const _privatePrefix = "/neighborhood-watch/private/";

  static const _membershipSuffix = "/membership";

  static String post(String postId) => "$_postPrefix$postId";

  static String patrol(String scheduleId) => "$_patrolPrefix$scheduleId";

  static String privateCommunity(String communityId) =>
      "$_privatePrefix$communityId";

  static String privateCommunityMembership(String communityId) =>
      "$_privatePrefix$communityId$_membershipSuffix";

  static bool isPostRoute(String route) =>
      route.startsWith(_postPrefix) && route.length > _postPrefix.length;

  static bool isPatrolRoute(String route) =>
      route.startsWith(_patrolPrefix) && route.length > _patrolPrefix.length;

  static bool isPrivateCommunityRoute(String route) =>
      route.startsWith(_privatePrefix) && route.length > _privatePrefix.length;

  static bool isPrivateMembershipRoute(String route) =>
      isPrivateCommunityRoute(route) && route.endsWith(_membershipSuffix);

  static String? postIdFromRoute(String route) {
    if (!isPostRoute(route)) return null;

    return route.substring(_postPrefix.length);
  }

  static String? patrolIdFromRoute(String route) {
    if (!isPatrolRoute(route)) return null;

    return route.substring(_patrolPrefix.length);
  }

  static String? privateCommunityIdFromRoute(String route) {
    if (!isPrivateCommunityRoute(route)) return null;

    var remainder = route.substring(_privatePrefix.length);

    if (remainder.endsWith(_membershipSuffix)) {
      remainder = remainder.substring(
        0,
        remainder.length - _membershipSuffix.length,
      );
    }

    return remainder.isEmpty ? null : remainder;
  }
}
