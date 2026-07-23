package com.theeye.watch

import android.content.Context
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class CrashRecoveryChannelHandler(
    private val context: Context,
) : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "readState" -> result.success(CrashSentinel.readRecoveryState(context))
            "markCleanShutdown" -> {
                CrashSentinel.markCleanShutdown(context)
                result.success(null)
            }
            "markUncleanShutdown" -> {
                CrashSentinel.markUncleanShutdown(context)
                result.success(null)
            }
            "snapshotEmergencyState" -> {
                val activeEmergency = call.argument<Boolean>("activeEmergency") ?: false
                val queuedSos = call.argument<Boolean>("queuedSos") ?: false
                CrashSentinel.snapshotEmergencyState(context, activeEmergency, queuedSos)
                result.success(null)
            }
            "clearRecovery" -> {
                CrashSentinel.clearRecovery(context)
                result.success(null)
            }
            "recordFlutterCrash" -> {
                CrashSentinel.recordFlutterCrash(context)
                result.success(null)
            }
            "markCorrupted" -> {
                CrashSentinel.markCorrupted(context)
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }
}
