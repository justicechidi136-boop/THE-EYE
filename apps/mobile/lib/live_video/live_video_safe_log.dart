import "package:flutter/foundation.dart";

void logLiveVideoEvent(String message) {
  assert(() {
    if (message
        .contains(RegExp(r"token|bearer|jwt|password", caseSensitive: false))) {
      throw FlutterError("Unsafe live video log message");
    }
    return true;
  }());
  debugPrint(message);
}
