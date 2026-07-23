package com.theeye.watch

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class EmergencyBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = context.getSharedPreferences(
            EmergencyTrackingService.PREFS_NAME,
            Context.MODE_PRIVATE,
        )
        val active = prefs.getBoolean(EmergencyTrackingService.KEY_ACTIVE, false)
        if (!active) return
        val silent = prefs.getBoolean(EmergencyTrackingService.KEY_SILENT, false)
        val sosEventId = prefs.getString(EmergencyTrackingService.KEY_SOS_EVENT_ID, null)
        EmergencyTrackingService.start(context, sosEventId, silent)
    }
}
