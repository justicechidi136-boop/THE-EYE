class PushNotificationRoute {
  const PushNotificationRoute({
    required this.schemaVersion,
    required this.routeType,
    required this.notificationType,
    required this.destination,
    this.incidentId,
    this.status,
    this.silent = false,
  });

  final int schemaVersion;
  final String routeType;
  final String? incidentId;
  final String? status;
  final String notificationType;
  final String destination;
  final bool silent;

  bool get opensActiveEmergency =>
      routeType == "OWN_ACTIVE_INCIDENT" || destination == "/active-emergency";

  bool get opensIncidentDetails =>
      routeType == "OWN_INCIDENT_DETAILS" || destination == "/incident-detail";
}

/// Server-authoritative notification routing contract (schema v1).
abstract final class PushNotificationRouting {
  static PushNotificationRoute? fromMessageData(Map<String, dynamic> data) {
    final schemaVersion = int.tryParse(data["schemaVersion"]?.toString() ?? "");
    if (schemaVersion == 1) {
      final destination = _sanitizeDestination(
        data["destination"] ?? data["route"] ?? data["deepLink"],
      );
      if (destination == null) return null;
      return PushNotificationRoute(
        schemaVersion: 1,
        routeType: data["routeType"]?.toString() ?? "SYSTEM",
        incidentId: data["incidentId"]?.toString(),
        status: data["status"]?.toString(),
        notificationType: data["notificationType"]?.toString() ??
            data["type"]?.toString() ??
            "System",
        destination: destination,
        silent: data["silent"]?.toString().toLowerCase() == "true",
      );
    }
    return null;
  }

  static String? _sanitizeDestination(Object? value) {
    if (value is! String) return null;
    final trimmed = value.trim();
    if (!trimmed.startsWith("/")) return null;
    if (trimmed.contains("..") || trimmed.contains("://")) return null;
    return trimmed.split("?").first;
  }
}
