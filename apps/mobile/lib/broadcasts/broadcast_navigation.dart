import "package:flutter/material.dart";

import "broadcast_feed_service.dart";
import "broadcast_screens.dart";

abstract final class BroadcastRoutes {
  static const center = "/broadcasts";
  static const create = "/broadcasts/create";
  static const mine = "/broadcasts/mine";
  static const createMissingPerson = "/broadcasts/create/missing-person";
  static const createStolenVehicle = "/broadcasts/create/stolen-vehicle";
}

class BroadcastRouteArgs {
  const BroadcastRouteArgs({required this.broadcastId});

  final String broadcastId;
}

class BroadcastDetailNavigationArgs {
  const BroadcastDetailNavigationArgs({
    this.returnToCenterOnBack = false,
  });

  final bool returnToCenterOnBack;
}

class ParsedBroadcastRoute {
  const ParsedBroadcastRoute._({
    required this.kind,
    this.broadcastId,
    this.sightingId,
  });

  final BroadcastRouteKind kind;
  final String? broadcastId;
  final String? sightingId;

  static ParsedBroadcastRoute? parse(String? routeName) {
    final name = routeName?.split("?").first.trim() ?? "";
    if (name.isEmpty || name == BroadcastRoutes.center) {
      return const ParsedBroadcastRoute._(kind: BroadcastRouteKind.center);
    }
    if (!name.startsWith("${BroadcastRoutes.center}/")) return null;

    final remainder = name.substring("${BroadcastRoutes.center}/".length);
    if (remainder.isEmpty) {
      return const ParsedBroadcastRoute._(kind: BroadcastRouteKind.center);
    }

    final segments =
        remainder.split("/").where((segment) => segment.isNotEmpty).toList();
    if (segments.isEmpty) {
      return const ParsedBroadcastRoute._(kind: BroadcastRouteKind.center);
    }

    switch (segments.first) {
      case "create":
        if (segments.length == 1) {
          return const ParsedBroadcastRoute._(
              kind: BroadcastRouteKind.createHub);
        }
        if (segments.length == 2 && segments[1] == "missing-person") {
          return const ParsedBroadcastRoute._(
            kind: BroadcastRouteKind.createMissingPerson,
          );
        }
        if (segments.length == 2 && segments[1] == "stolen-vehicle") {
          return const ParsedBroadcastRoute._(
            kind: BroadcastRouteKind.createStolenVehicle,
          );
        }
        return null;
      case "mine":
        if (segments.length == 1) {
          return const ParsedBroadcastRoute._(kind: BroadcastRouteKind.mine);
        }
        return null;
    }

    final broadcastId = segments.first;
    if (!_isValidBroadcastId(broadcastId)) return null;

    if (segments.length == 1) {
      return ParsedBroadcastRoute._(
        kind: BroadcastRouteKind.detail,
        broadcastId: broadcastId,
      );
    }

    if (segments.length == 3 &&
        segments[1] == "sightings" &&
        _isValidBroadcastId(segments[2])) {
      return ParsedBroadcastRoute._(
        kind: BroadcastRouteKind.sightingDetail,
        broadcastId: broadcastId,
        sightingId: segments[2],
      );
    }

    final action = segments[1];
    return switch (action) {
      "comments" when segments.length == 2 => ParsedBroadcastRoute._(
          kind: BroadcastRouteKind.comments,
          broadcastId: broadcastId,
        ),
      "report" when segments.length == 2 => ParsedBroadcastRoute._(
          kind: BroadcastRouteKind.report,
          broadcastId: broadcastId,
        ),
      "share" when segments.length == 2 => ParsedBroadcastRoute._(
          kind: BroadcastRouteKind.share,
          broadcastId: broadcastId,
        ),
      "sighting" when segments.length == 2 => ParsedBroadcastRoute._(
          kind: BroadcastRouteKind.sighting,
          broadcastId: broadcastId,
        ),
      _ => null,
    };
  }

  static bool _isValidBroadcastId(String value) {
    if (value.isEmpty || value.contains("..")) return false;
    return !const {"create", "mine", "nearby"}.contains(value);
  }
}

enum BroadcastRouteKind {
  center,
  createHub,
  createMissingPerson,
  createStolenVehicle,
  mine,
  detail,
  comments,
  report,
  share,
  sighting,
  sightingDetail,
}

typedef MissingPersonBroadcastBuilder = Widget Function();
typedef StolenVehicleBroadcastBuilder = Widget Function();

Route<dynamic>? resolveBroadcastRoute(
  RouteSettings settings, {
  MissingPersonBroadcastBuilder? missingPersonBuilder,
  StolenVehicleBroadcastBuilder? stolenVehicleBuilder,
}) {
  final parsed = ParsedBroadcastRoute.parse(settings.name);
  if (parsed == null) return null;

  switch (parsed.kind) {
    case BroadcastRouteKind.center:
      return null;
    case BroadcastRouteKind.createHub:
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => const BroadcastCreateHubScreen(),
      );
    case BroadcastRouteKind.createMissingPerson:
      if (missingPersonBuilder == null) return null;
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => missingPersonBuilder(),
      );
    case BroadcastRouteKind.createStolenVehicle:
      if (stolenVehicleBuilder == null) return null;
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => stolenVehicleBuilder(),
      );
    case BroadcastRouteKind.mine:
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => const MyBroadcastsScreen(),
      );
    case BroadcastRouteKind.detail:
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => BroadcastDetailScreen(
          broadcastId: parsed.broadcastId!,
        ),
      );
    case BroadcastRouteKind.comments:
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => BroadcastCommentsScreen(
          broadcastId: parsed.broadcastId!,
        ),
      );
    case BroadcastRouteKind.report:
      final source = settings.arguments is BroadcastFeedItem
          ? settings.arguments as BroadcastFeedItem
          : null;
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => BroadcastReportScreen(
          broadcastId: parsed.broadcastId!,
          source: source,
        ),
      );
    case BroadcastRouteKind.share:
      final source = settings.arguments is BroadcastFeedItem
          ? settings.arguments as BroadcastFeedItem
          : null;
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => BroadcastShareScreen(
          broadcastId: parsed.broadcastId!,
          fallbackSource: source,
        ),
      );
    case BroadcastRouteKind.sighting:
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => SubmitSightingScreen(
          broadcastId: parsed.broadcastId!,
        ),
      );
    case BroadcastRouteKind.sightingDetail:
      return MaterialPageRoute(
        settings: settings,
        builder: (_) => SightingDetailsScreen(
          broadcastId: parsed.broadcastId!,
          sightingId: parsed.sightingId!,
        ),
      );
  }
}

String? broadcastSightingDetailRoute(String broadcastId, String sightingId) {
  final safeBroadcastId = broadcastId.trim();
  final safeSightingId = sightingId.trim();
  if (safeBroadcastId.isEmpty || safeSightingId.isEmpty) return null;
  return "${BroadcastRoutes.center}/$safeBroadcastId/sightings/$safeSightingId";
}

String? broadcastDetailRoute(String broadcastId) {
  final trimmed = broadcastId.trim();
  if (trimmed.isEmpty) return null;
  return "${BroadcastRoutes.center}/$trimmed";
}
