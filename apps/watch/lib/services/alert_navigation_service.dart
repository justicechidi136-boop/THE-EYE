import 'package:flutter/material.dart';

import '../models/alert.dart';
import '../screens/routes.dart';
import '../storage/secure_credential_store.dart';
import 'alert_service.dart';
import 'push_message_router.dart';
import 'sos_service.dart';

/// Routes push alerts to the correct screen using authoritative server state.
class AlertNavigationService {
  AlertNavigationService({
    required GlobalKey<NavigatorState> navigatorKey,
    required AlertService alerts,
    required SosService sos,
    required SecureCredentialStore credentials,
  })  : _navigatorKey = navigatorKey,
        _alerts = alerts,
        _sos = sos,
        _credentials = credentials;

  final GlobalKey<NavigatorState> _navigatorKey;
  final AlertService _alerts;
  final SosService _sos;
  final SecureCredentialStore _credentials;
  String? _lastNavigationKey;

  Future<void> handlePushAlert({
    required String title,
    required String body,
    String? incidentId,
    String? notificationId,
    String priority = 'High',
    String category = WatchPushCategories.emergencyAlert,
  }) async {
    if (!await _canOpenProtectedContent()) return;

    await _alerts.syncHistoryFromServer();

    final nav = _navigatorKey.currentState;
    if (nav == null) return;

    final dedupeKey = '$category:${notificationId ?? incidentId ?? title}';
    if (_lastNavigationKey == dedupeKey) return;
    _lastNavigationKey = dedupeKey;

    if (category == WatchPushCategories.incidentStatus ||
        category == WatchPushCategories.emergencyAlert ||
        category == WatchPushCategories.sosAck) {
      await _sos.syncEmergencyTracking();
      if (_isCurrentRoute(nav, WatchRoutes.activeEmergency)) return;
      await nav.pushNamed(
        WatchRoutes.activeEmergency,
        arguments: incidentId,
      );
      return;
    }

    await _alerts.recordIncoming(
      title: title,
      body: body,
      incidentId: incidentId,
      notificationId: notificationId,
      priority: priority,
    );

    final history = await _alerts.loadHistory();
    WatchAlert? match;
    for (final alert in history) {
      if (notificationId != null && alert.notificationId == notificationId) {
        match = alert;
        break;
      }
      if (incidentId != null && alert.incidentId == incidentId) {
        match = alert;
        break;
      }
    }
    match ??= history.isNotEmpty ? history.first : null;

    if (_isCurrentRoute(nav, WatchRoutes.incomingAlert)) return;
    if (match != null) {
      await nav.pushNamed(WatchRoutes.incomingAlert, arguments: match);
    } else {
      await nav.pushNamed(WatchRoutes.incomingAlert);
    }
  }

  Future<bool> _canOpenProtectedContent() async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    return deviceId != null &&
        deviceSecret != null &&
        deviceSecret.isNotEmpty;
  }

  bool _isCurrentRoute(NavigatorState nav, String routeName) {
    return ModalRoute.of(nav.context)?.settings.name == routeName;
  }
}
