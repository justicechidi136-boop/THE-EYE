import 'package:firebase_messaging/firebase_messaging.dart';

/// Watch-specific FCM categories. Only these are surfaced as watch alerts.
abstract final class WatchPushCategories {
  static const sosAck = 'SosAck';
  static const familySos = 'FamilySosAlert';
  static const emergencyAlert = 'EmergencyAlert';
  static const incidentStatus = 'IncidentStatusUpdate';
  static const broadcastAlert = 'BroadcastAlert';
  static const missingPerson = 'MissingPersonAlert';
  static const stolenVehicle = 'StolenVehicleAlert';

  static const allowed = <String>{
    sosAck,
    familySos,
    emergencyAlert,
    incidentStatus,
    broadcastAlert,
    missingPerson,
    stolenVehicle,
  };
}

typedef WatchAlertHandler = Future<void> Function({
  required String title,
  required String body,
  String? incidentId,
  String? notificationId,
  String priority,
  String category,
});

class PushMessageRouter {
  static WatchAlertHandler? onAlert;

  static bool isWatchCategory(String? type) {
    if (type == null || type.isEmpty) return false;
    return WatchPushCategories.allowed.contains(type);
  }

  static Future<void> handleForeground(RemoteMessage message) async {
    await _dispatch(message);
  }

  static Future<void> handleBackground(RemoteMessage message) async {
    await _dispatch(message);
  }

  static Future<void> _dispatch(RemoteMessage message) async {
    final data = message.data;
    final type = data['type']?.toString();
    if (!isWatchCategory(type)) return;

    final handler = onAlert;
    if (handler == null) return;

    await handler(
      title: message.notification?.title ??
          data['title']?.toString() ??
          'THE EYE Alert',
      body: message.notification?.body ?? data['body']?.toString() ?? '',
      incidentId: data['incidentId']?.toString(),
      notificationId: data['notificationId']?.toString(),
      priority: data['priority']?.toString() ?? 'High',
      category: type ?? WatchPushCategories.emergencyAlert,
    );
  }
}
