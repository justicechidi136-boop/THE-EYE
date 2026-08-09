package com.theeye.fieldops

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * After reboot on managed/launcher devices, bring THE EYE Field Ops forward.
 * Authentication is never bypassed — Flutter splash still enforces session/device state.
 */
class FieldBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) {
            return
        }
        val mode = BuildConfig.FIELD_DEVICE_MODE.lowercase()
        if (mode != "launcher" && mode != "managed_kiosk") {
            return
        }
        Log.i(TAG, "Boot completed — launching Field Ops ($mode)")
        val launch = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("boot_launch", true)
        }
        context.startActivity(launch)
    }

    companion object {
        private const val TAG = "FieldBootReceiver"
    }
}
