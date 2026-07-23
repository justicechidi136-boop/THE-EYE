package com.theeye.watch

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class EmergencyTrackingService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!hasLocationPermission()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val silent = intent?.getBooleanExtra(EXTRA_SILENT, false) ?: false
        createChannel()
        val notification = buildNotification(silent)
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Emergency location",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Active emergency location sharing"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(silent: Boolean): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = if (silent) "Discreet safety session" else "Emergency location active"
        val body = if (silent) {
            "Location sharing is active for your safety session."
        } else {
            "THE EYE is sharing your location during an active emergency."
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "the_eye_emergency_location"
        const val NOTIFICATION_ID = 4101
        const val EXTRA_SILENT = "silent"
        const val EXTRA_SOS_EVENT_ID = "sosEventId"
        const val PREFS_NAME = "the_eye_emergency_tracking"
        const val KEY_ACTIVE = "active"
        const val KEY_SILENT = "silent"
        const val KEY_SOS_EVENT_ID = "sosEventId"

        fun start(context: Context, sosEventId: String?, silent: Boolean) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_ACTIVE, true)
                .putBoolean(KEY_SILENT, silent)
                .putString(KEY_SOS_EVENT_ID, sosEventId)
                .apply()
            val intent = Intent(context, EmergencyTrackingService::class.java).apply {
                putExtra(EXTRA_SOS_EVENT_ID, sosEventId)
                putExtra(EXTRA_SILENT, silent)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_ACTIVE)
                .remove(KEY_SILENT)
                .remove(KEY_SOS_EVENT_ID)
                .apply()
            context.stopService(Intent(context, EmergencyTrackingService::class.java))
        }
    }
}
