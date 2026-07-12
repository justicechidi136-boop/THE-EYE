import "package:firebase_core/firebase_core.dart";
import "package:firebase_messaging/firebase_messaging.dart";

import "../config/firebase_bootstrap.dart";
import "push_safe_log.dart";

@pragma("vm:entry-point")
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await initializeMobileFirebase();
  logPushEvent(
      "Background notification received (messageId=${message.messageId ?? "unknown"})");
}
