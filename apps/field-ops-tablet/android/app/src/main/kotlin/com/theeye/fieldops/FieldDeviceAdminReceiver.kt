package com.theeye.fieldops

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives Device Admin / Device Owner callbacks when an MDM provisions
 * THE EYE Field Ops as a managed dedicated device.
 *
 * The app does NOT request Device Owner silently. Provisioning is external
 * (ADB / Android Enterprise / approved MDM) only.
 */
class FieldDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        Log.i(TAG, "Field device admin enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Log.i(TAG, "Field device admin disabled")
    }

    override fun onLockTaskModeEntering(context: Context, intent: Intent, pkg: String) {
        Log.i(TAG, "Lock task entering for $pkg")
    }

    override fun onLockTaskModeExiting(context: Context, intent: Intent) {
        Log.i(TAG, "Lock task exiting")
    }

    companion object {
        private const val TAG = "FieldDeviceAdmin"
    }
}
