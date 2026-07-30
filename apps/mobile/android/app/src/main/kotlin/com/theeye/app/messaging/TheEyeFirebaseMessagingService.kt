package com.theeye.app.messaging

import com.google.firebase.messaging.RemoteMessage
import io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingService

/**
 * Native-first danger alert relay for background / killed-app delivery.
 * Delegates all other messages to the Flutter Firebase messaging service.
 *
 * Platform limitation: after user force-stop, Android may defer FCM until the app is reopened.
 */
class TheEyeFirebaseMessagingService : FlutterFirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (WatchDangerAlertRelayHandler.handle(this, message)) {
            return
        }
        super.onMessageReceived(message)
    }
}
