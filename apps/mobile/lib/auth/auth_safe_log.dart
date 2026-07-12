import "package:flutter/foundation.dart";

void logAuthEvent(String message) {
  assert(() {
    if (message
        .contains(RegExp(r"password|otp|token|bearer", caseSensitive: false))) {
      throw FlutterError("Unsafe auth log message");
    }
    return true;
  }());
  debugPrint(message);
}
