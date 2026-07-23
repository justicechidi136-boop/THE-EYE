package com.theeye.watch

import android.content.Context
import android.content.pm.PackageManager
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Wear Data Layer companion bridge. Returns unavailable when Play Services /
 * companion app are not present — Dart falls back to direct HTTPS.
 */
class WearCompanionChannelHandler(
    private val context: Context,
) : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isSupported" -> result.success(isWearOs())
            "availability" -> {
                result.success(
                    mapOf(
                        "wearOs" to isWearOs(),
                        "playServices" to false,
                        "companionApp" to false,
                        "available" to false,
                    ),
                )
            }
            "sendMessage" -> result.error(
                "UNAVAILABLE",
                "Wear Data Layer companion not connected",
                null,
            )
            else -> result.notImplemented()
        }
    }

    private fun isWearOs(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_WATCH)
    }
}
