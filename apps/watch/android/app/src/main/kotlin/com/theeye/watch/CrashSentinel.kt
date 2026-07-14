package com.theeye.watch

import android.content.Context
import android.content.Intent

object CrashSentinel {
    private const val PREFS = "theeye_crash_sentinel"
    private const val KEY_COUNT = "flutter_crash_count"
    private const val THRESHOLD = 3

    fun recordFlutterCrash(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val next = prefs.getInt(KEY_COUNT, 0) + 1
        prefs.edit().putInt(KEY_COUNT, next).apply()
        if (next >= THRESHOLD) {
            val intent = Intent(context, RecoveryActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun reset(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_COUNT, 0)
            .apply()
    }
}
