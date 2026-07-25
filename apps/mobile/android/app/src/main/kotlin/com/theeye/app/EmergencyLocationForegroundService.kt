package com.theeye.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class EmergencyLocationForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        promoteToForeground(DEFAULT_INCIDENT_ID)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val incidentId = intent?.getStringExtra(EXTRA_INCIDENT_ID) ?: DEFAULT_INCIDENT_ID
                ensureChannel()
                promoteToForeground(incidentId)
                return START_STICKY
            }
        }
    }

    private fun promoteToForeground(incidentId: String) {
        try {
            val notification = buildNotification(incidentId)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
                )
            } else {
                @Suppress("DEPRECATION")
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (error: Exception) {
            Log.e(TAG, "Emergency FGS startForeground failed", error)
            try {
                val fallback = buildFallbackNotification(incidentId)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        fallback,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
                    )
                } else {
                    @Suppress("DEPRECATION")
                    startForeground(NOTIFICATION_ID, fallback)
                }
            } catch (fallbackError: Exception) {
                Log.e(TAG, "Emergency FGS fallback startForeground failed", fallbackError)
                stopSelf()
            }
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Emergency location",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Shows when THE EYE is sharing your location during an active emergency."
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun resolveSmallIcon(): Int {
        val id = resources.getIdentifier("ic_notification", "drawable", packageName)
        return if (id != 0) id else android.R.drawable.ic_menu_mylocation
    }

    private fun buildNotification(incidentId: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("THE EYE emergency location active")
            .setContentText("Sharing location for incident $incidentId")
            .setSmallIcon(resolveSmallIcon())
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun buildFallbackNotification(incidentId: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("THE EYE emergency location active")
            .setContentText("Sharing location for incident $incidentId")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .setOnlyAlertOnce(true)
            .build()
    }

    companion object {
        private const val TAG = "EmergencyLocationFGS"
        const val ACTION_STOP = "com.theeye.app.emergency_location.STOP"
        const val EXTRA_INCIDENT_ID = "incidentId"
        private const val CHANNEL_ID = "the_eye_emergency_location"
        private const val NOTIFICATION_ID = 41001
        private const val DEFAULT_INCIDENT_ID = "active"

        fun start(context: Context, incidentId: String) {
            val intent = Intent(context, EmergencyLocationForegroundService::class.java).apply {
                putExtra(EXTRA_INCIDENT_ID, incidentId)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (error: Exception) {
                Log.e(TAG, "Unable to start emergency location foreground service", error)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, EmergencyLocationForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
