import "package:firebase_core/firebase_core.dart";
import "package:firebase_messaging/firebase_messaging.dart";
import "package:shared_preferences/shared_preferences.dart";

import "../config/app_flavor.dart";
import "../config/firebase_bootstrap.dart";
import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "push_device_id.dart";
import "push_safe_log.dart";

const _backgroundAckPrefix = "the_eye.push.ack.";

@pragma("vm:entry-point")
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await initializeMobileFirebase();
  logPushEvent(
      "Background notification received (messageId=${message.messageId ?? "unknown"})");

  final notificationId = message.data["notificationId"]?.toString() ?? "";
  if (notificationId.isEmpty) return;

  final prefs = await SharedPreferences.getInstance();
  final ackKey = "$_backgroundAckPrefix$notificationId";
  if (prefs.getBool(ackKey) == true) return;

  final accessToken = prefs.getString("the_eye.auth.access_token");
  if (accessToken == null || accessToken.isEmpty) return;

  final apiBaseUrl = prefs.getString("the_eye.api.base_url");
  if (apiBaseUrl == null || apiBaseUrl.isEmpty) return;

  try {
    final client = TheEyeApiClient(baseUrl: apiBaseUrl);
    final response = await client.patchJson(
      TheEyeApiPaths.notificationDeviceReceived(notificationId),
      {"source": "background"},
      accessToken: accessToken,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      await prefs.setBool(ackKey, true);
      logPushEvent("Background delivery ack recorded for $notificationId.");
    }
  } catch (_) {
    logPushEvent("Background delivery ack failed for $notificationId.");
  }
}

Future<void> persistBackgroundPushContext({
  required String accessToken,
  required String apiBaseUrl,
}) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString("the_eye.auth.access_token", accessToken);
  await prefs.setString("the_eye.api.base_url", apiBaseUrl);
  await resolveMobileDeviceId();
  if (Firebase.apps.isEmpty) {
    await initializeMobileFirebase();
  }
  logPushEvent(
      "Background push context persisted for ${AppFlavorConfig.firebaseEnvName}.");
}
