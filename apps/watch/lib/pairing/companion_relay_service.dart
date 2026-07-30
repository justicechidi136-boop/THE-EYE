import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';

import '../alerts/danger_alert_models.dart';

typedef CompanionRelayHandler = Future<void> Function(DangerAlertPayload payload);

class CompanionRelayService {
  CompanionRelayService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('com.theeye.watch/companion_relay');

  static const dangerAlertPath = '/theeye/danger-alert';
  static const dangerAckPath = '/theeye/danger-ack';

  final MethodChannel _channel;
  CompanionRelayHandler? onDangerAlert;
  void Function(String safetyAlertId)? onAckFromPhone;

  Future<void> startListening() async {
    _channel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'dangerAlert':
          final raw = call.arguments;
          if (raw is String) {
            final data = Map<String, dynamic>.from(jsonDecode(raw) as Map);
            final payload = parseDangerAlertPayload(data);
            if (payload != null) {
              await onDangerAlert?.call(payload);
            }
          }
        case 'dangerAck':
          final alertId = call.arguments?.toString();
          if (alertId != null && alertId.isNotEmpty) {
            onAckFromPhone?.call(alertId);
          }
      }
    });
    await _channel.invokeMethod<void>('startListening');
  }

  Future<bool> isPhoneReachable() async {
    try {
      return await _channel.invokeMethod<bool>('isPhoneReachable') ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<void> sendAcknowledgement(String safetyAlertId) async {
    try {
      await _channel.invokeMethod<void>('sendAcknowledgement', safetyAlertId);
    } catch (_) {}
  }

  Future<void> dispose() async {
    try {
      await _channel.invokeMethod<void>('stopListening');
    } catch (_) {}
  }
}
