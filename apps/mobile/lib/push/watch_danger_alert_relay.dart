import "dart:convert";

import "package:flutter/services.dart";

/// Relays structured danger alerts from the paired phone to the watch via Wearable Data Layer.
class WatchDangerAlertRelay {
  WatchDangerAlertRelay({MethodChannel? channel})
      : _channel = channel ??
            const MethodChannel("com.theeye.app/watch_danger_relay");

  final MethodChannel _channel;

  Future<bool> relayDangerAlert(Map<String, dynamic> fcmData) async {
    try {
      final payload = Map<String, dynamic>.from(fcmData);
      payload.remove("notification");
      final sent = await _channel.invokeMethod<bool>(
        "relayDangerAlert",
        jsonEncode(payload),
      );
      return sent ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<void> relayAcknowledgement(String safetyAlertId) async {
    try {
      await _channel.invokeMethod<void>("relayAcknowledgement", safetyAlertId);
    } catch (_) {}
  }

  Future<bool> isWatchReachable() async {
    try {
      return await _channel.invokeMethod<bool>("isWatchReachable") ?? false;
    } catch (_) {
      return false;
    }
  }
}

/// Parses phone FCM danger alert payloads and decides relay eligibility.
class DangerAlertPhoneHandler {
  static const nearbyDangerWarning = "NearbyDangerWarning";

  static bool shouldRelayToWatch(Map<String, dynamic> data) {
    final type = data["type"]?.toString() ?? "";
    if (type != nearbyDangerWarning) return false;
    final relay = data["relayToWatch"]?.toString().toLowerCase();
    return relay == "true" || relay == "1";
  }

  static bool hasTrustedAlertCode(Map<String, dynamic> data) {
    final code = data["dangerAlertCode"]?.toString() ?? "";
    return code.startsWith("DANGER_ZONE_");
  }
}
