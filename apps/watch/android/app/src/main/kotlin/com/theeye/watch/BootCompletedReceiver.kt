package com.theeye.watch

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Restarts THE EYE launcher safely after device boot (Target B full Android watches).
 * Does not start background services — Flutter boot sequencer handles runtime init.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        EmergencyTrackingService.restoreIfNeeded(context)
        val launch = Intent(context, LauncherHomeActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        context.startActivity(launch)
    }
}
