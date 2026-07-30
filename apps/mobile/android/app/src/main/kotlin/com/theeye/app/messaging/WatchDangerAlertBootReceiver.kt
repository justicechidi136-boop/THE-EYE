package com.theeye.app.messaging

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WatchDangerAlertBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        WatchDangerAlertRelayHandler.flushPending(context.applicationContext)
    }
}
