import "dart:async";

import "package:flutter/foundation.dart";
import "package:flutter/material.dart";

/// Safe startup logging and global error capture for THE EYE mobile.
abstract final class StartupDiagnostics {
  static void install() {
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      _log("FlutterError: ${details.exceptionAsString()}");
      if (details.stack != null) {
        debugPrintStack(stackTrace: details.stack, label: "STARTUP stack");
      }
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      _log("PlatformDispatcher error: $error");
      debugPrintStack(stackTrace: stack, label: "STARTUP platform stack");
      return true;
    };
  }

  static void checkpoint(String message) {
    _log(message);
  }

  static void recordZoneError(Object error, StackTrace stack) {
    _log("Zone error: $error");
    debugPrintStack(stackTrace: stack, label: "STARTUP zone stack");
  }

  static void _log(String message) {
    debugPrint("THE EYE $message");
  }
}

Widget brandedStartupErrorBuilder(FlutterErrorDetails details) {
  StartupDiagnostics._log("ErrorWidget: ${details.exceptionAsString()}");
  return Material(
    color: const Color(0xFF0B0F14),
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Color(0xFFFF4D4F), size: 48),
            const SizedBox(height: 16),
            const Text(
              "THE EYE hit a startup error",
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              details.exceptionAsString(),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFB8C2CC), fontSize: 12),
            ),
          ],
        ),
      ),
    ),
  );
}
