import "package:flutter/material.dart";

import "../emergency/active_emergency_navigation.dart";
import "activity_history_service.dart";

abstract final class ActivityRoutes {
  static const history = "/tracking";
  static String incidentArchive(String incidentId) => "/incident-archive/$incidentId";
  static String broadcastArchive(String broadcastId) => "/broadcast-archive/$broadcastId";
}

Future<void> openActivityDestination(
  BuildContext context,
  ActiveEmergencyNavigationController controller, {
  required ActivityNavigationTarget navigation,
  bool silent = false,
}) async {
  switch (navigation.destination) {
    case "active-emergency":
      final incidentId = navigation.incidentId;
      if (incidentId == null || incidentId.isEmpty) return;
      await ActiveEmergencyNavigation.open(
        context,
        controller,
        incidentId: incidentId,
        silent: silent,
      );
      return;
    case "broadcast-archive":
      final broadcastId = navigation.broadcastId;
      if (broadcastId == null || broadcastId.isEmpty) return;
      await Navigator.of(context).pushNamed(ActivityRoutes.broadcastArchive(broadcastId));
      return;
    case "incident-archive":
    default:
      final incidentId = navigation.incidentId;
      if (incidentId == null || incidentId.isEmpty) return;
      await Navigator.of(context).pushNamed(ActivityRoutes.incidentArchive(incidentId));
  }
}
