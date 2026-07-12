import 'package:firebase_messaging/firebase_messaging.dart';

import 'push_message_router.dart';

/// Top-level background handler required by `firebase_messaging`.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await PushMessageRouter.handleBackground(message);
}
