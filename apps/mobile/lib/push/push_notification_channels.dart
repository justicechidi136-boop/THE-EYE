import "dart:typed_data";

import "package:flutter/material.dart" show Color;
import "package:flutter_local_notifications/flutter_local_notifications.dart";

abstract final class PushNotificationChannels {
  static final dangerAlerts = AndroidNotificationChannel(
    "the_eye_danger_alerts_v2",
    "Danger alerts",
    description: "Urgent danger alerts within 4 km",
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
    vibrationPattern: Int64List.fromList([0, 500, 180, 500, 180, 850]),
    enableLights: true,
    ledColor: Color(0xFFD32F2F),
    audioAttributesUsage: AudioAttributesUsage.alarm,
  );

  static const emergency = AndroidNotificationChannel(
    "the_eye_emergency",
    "Emergency",
    description: "Critical emergency and SOS alerts",
    importance: Importance.max,
    playSound: true,
  );

  static const incidentUpdates = AndroidNotificationChannel(
    "the_eye_incident_updates",
    "Incident updates",
    description: "Incident status and verification updates",
    importance: Importance.high,
  );

  static const neighborhoodWatch = AndroidNotificationChannel(
    "the_eye_neighborhood_watch",
    "Neighborhood watch",
    description: "Community watch posts and alerts",
    importance: Importance.high,
  );

  static const missingPersons = AndroidNotificationChannel(
    "the_eye_missing_persons",
    "Missing persons",
    description: "Missing person broadcast alerts",
    importance: Importance.high,
  );

  static const stolenVehicles = AndroidNotificationChannel(
    "the_eye_stolen_vehicles",
    "Stolen vehicles",
    description: "Stolen vehicle broadcast alerts",
    importance: Importance.high,
  );

  static const general = AndroidNotificationChannel(
    "the_eye_general",
    "General",
    description: "General safety and platform notifications",
    importance: Importance.defaultImportance,
  );

  static final all = [
    dangerAlerts,
    emergency,
    incidentUpdates,
    neighborhoodWatch,
    missingPersons,
    stolenVehicles,
    general,
  ];

  static String resolveChannelId(
      {String? type, String? priority, String? route}) {
    final normalizedType = (type ?? "").toLowerCase();
    final normalizedPriority = (priority ?? "").toLowerCase();
    final normalizedRoute = (route ?? "").toLowerCase();

    if (normalizedType.contains("nearbydangerwarning") ||
        normalizedRoute.contains("/danger-trigger")) {
      return dangerAlerts.id;
    }

    if (normalizedPriority.contains("critical") ||
        normalizedPriority.contains("p1") ||
        normalizedType.contains("emergency") ||
        normalizedType.contains("sos")) {
      return emergency.id;
    }
    if (normalizedType.contains("missingperson") ||
        normalizedRoute.contains("/missing-person")) {
      return missingPersons.id;
    }
    if (normalizedType.contains("stolenvehicle") ||
        normalizedRoute.contains("/stolen-vehicle")) {
      return stolenVehicles.id;
    }
    if (normalizedType.contains("neighborhood") ||
        normalizedType.contains("community") ||
        normalizedRoute.contains("/neighborhood-watch")) {
      return neighborhoodWatch.id;
    }
    if (normalizedType.contains("incident") ||
        normalizedType.contains("status") ||
        normalizedRoute.contains("/tracking")) {
      return incidentUpdates.id;
    }
    return general.id;
  }
}
