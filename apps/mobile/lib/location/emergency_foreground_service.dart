import "dart:io";

import "package:flutter/services.dart";

/// Android foreground location service bridge for active emergency tracking.
abstract final class EmergencyForegroundService {
  static const _channel = MethodChannel("com.theeye.app/emergency_location");

  static Future<void> start({required String incidentId}) async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<void>("start", {"incidentId": incidentId});
    } catch (_) {
      // Best-effort; coordinator tracking continues in-process.
    }
  }

  static Future<void> stop() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<void>("stop");
    } catch (_) {
      // Best-effort.
    }
  }
}
