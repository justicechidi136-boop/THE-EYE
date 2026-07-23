package com.theeye.watch

import android.content.Context
import android.content.Intent

object CrashSentinel {
    private const val PREFS = "theeye_crash_sentinel"
    private const val KEY_COUNT = "flutter_crash_count"
    private const val KEY_UNCLEAN = "unclean_shutdown"
    private const val KEY_ACTIVE_EMERGENCY = "active_emergency"
    private const val KEY_QUEUED_SOS = "queued_sos"
    private const val KEY_CORRUPTED = "sentinel_corrupted"
    private const val THRESHOLD = 3

    fun markUncleanShutdown(context: Context) {
        prefs(context).edit().putBoolean(KEY_UNCLEAN, true).apply()
    }

    fun markCleanShutdown(context: Context) {
        prefs(context).edit()
            .putBoolean(KEY_UNCLEAN, false)
            .putInt(KEY_COUNT, 0)
            .putBoolean(KEY_CORRUPTED, false)
            .apply()
    }

    fun snapshotEmergencyState(context: Context, activeEmergency: Boolean, queuedSos: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_ACTIVE_EMERGENCY, activeEmergency)
            .putBoolean(KEY_QUEUED_SOS, queuedSos)
            .apply()
    }

    fun readRecoveryState(context: Context): Map<String, Any> {
        val prefs = prefs(context)
        if (prefs.getBoolean(KEY_CORRUPTED, false)) {
            return mapOf(
                "uncleanShutdown" to false,
                "activeEmergency" to false,
                "queuedSos" to false,
                "crashCount" to 0,
                "recoveryLoopBlocked" to true,
                "corrupted" to true,
            )
        }
        val crashCount = prefs.getInt(KEY_COUNT, 0)
        return mapOf(
            "uncleanShutdown" to prefs.getBoolean(KEY_UNCLEAN, false),
            "activeEmergency" to prefs.getBoolean(KEY_ACTIVE_EMERGENCY, false),
            "queuedSos" to prefs.getBoolean(KEY_QUEUED_SOS, false),
            "crashCount" to crashCount,
            "recoveryLoopBlocked" to (crashCount >= THRESHOLD),
            "corrupted" to false,
        )
    }

    fun clearRecovery(context: Context) {
        prefs(context).edit()
            .putBoolean(KEY_UNCLEAN, false)
            .putBoolean(KEY_ACTIVE_EMERGENCY, false)
            .putBoolean(KEY_QUEUED_SOS, false)
            .putInt(KEY_COUNT, 0)
            .putBoolean(KEY_CORRUPTED, false)
            .apply()
    }

    fun recordFlutterCrash(context: Context) {
        val prefs = prefs(context)
        val next = prefs.getInt(KEY_COUNT, 0) + 1
        prefs.edit()
            .putInt(KEY_COUNT, next)
            .putBoolean(KEY_UNCLEAN, true)
            .apply()
        if (next >= THRESHOLD) {
            val intent = Intent(context, RecoveryActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun markCorrupted(context: Context) {
        prefs(context).edit().putBoolean(KEY_CORRUPTED, true).apply()
    }

    fun reset(context: Context) = clearRecovery(context)

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
