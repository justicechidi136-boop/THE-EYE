package com.theeye.app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
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
    }
}
