package com.theeye.app

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    private var watchRelayBridge: WatchDangerAlertRelayBridge? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        watchRelayBridge = WatchDangerAlertRelayBridge(this)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.theeye.app/emergency_location",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> {
                    val incidentId = call.argument<String>("incidentId") ?: "active"
                    EmergencyLocationForegroundService.start(this, incidentId)
                    result.success(null)
                }
                "stop" -> {
                    EmergencyLocationForegroundService.stop(this)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            WatchDangerAlertRelayBridge.CHANNEL,
        ).setMethodCallHandler { call, result ->
            val bridge = watchRelayBridge ?: return@setMethodCallHandler result.error(
                "UNAVAILABLE",
                "Watch relay bridge unavailable",
                null,
            )
            when (call.method) {
                "relayDangerAlert" -> {
                    val payload = call.arguments?.toString() ?: ""
                    bridge.relayDangerAlert(payload) { sent -> result.success(sent) }
                }
                "relayAcknowledgement" -> {
                    val alertId = call.arguments?.toString() ?: ""
                    bridge.relayAcknowledgement(alertId)
                    result.success(true)
                }
                "isWatchReachable" -> {
                    bridge.isWatchReachable { reachable -> result.success(reachable) }
                }
                else -> result.notImplemented()
            }
        }
    }
}
