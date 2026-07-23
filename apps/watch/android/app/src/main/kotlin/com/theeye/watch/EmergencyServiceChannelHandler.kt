package com.theeye.watch

import android.content.Context
import android.content.pm.PackageManager
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class EmergencyServiceChannelHandler(
    private val context: Context,
) : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isWearOs" -> result.success(isWearOs())
            "isActive" -> result.success(EmergencyTrackingService.isActive(context))
            "start" -> {
                val args = call.arguments as? Map<*, *>
                val authorized = args?.get("authorized") as? Boolean ?: false
                if (!authorized) {
                    result.error("UNAUTHORIZED", "Emergency service requires authorized start", null)
                    return
                }
                EmergencyTrackingService.startAuthorized(
                    context,
                    args?.get("sosEventId") as? String,
                    args?.get("incidentId") as? String,
                    args?.get("silent") as? Boolean ?: false,
                )
                result.success(null)
            }
            "stop" -> {
                EmergencyTrackingService.stop(context)
                result.success(null)
            }
            "restore" -> {
                EmergencyTrackingService.restoreIfNeeded(context)
                result.success(EmergencyTrackingService.isActive(context))
            }
            else -> result.notImplemented()
        }
    }

    private fun isWearOs(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_WATCH)
    }
}
