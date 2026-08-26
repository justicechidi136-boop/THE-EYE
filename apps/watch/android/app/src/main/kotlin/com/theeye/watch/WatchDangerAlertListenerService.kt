package com.theeye.watch

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

class WatchDangerAlertListenerService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != CompanionRelayBridge.ALERT_PATH) return
        val payload = try {
            JSONObject(String(event.data, Charsets.UTF_8))
        } catch (_: Exception) {
            return
        }
        if (payload.optString("type") != "NearbyDangerWarning" ||
            !payload.optString("dangerAlertCode").startsWith("DANGER_ZONE_") ||
            payload.optInt("dangerAlertSchemaVersion", 0) != 1 ||
            isExpired(payload)
        ) return

        ensureChannel(this)
        val alertId = payload.optString("alertId", "danger-alert")
        val intent = Intent(this, LauncherHomeActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("dangerAlertPayload", payload.toString())
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            alertId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_danger_alert)
            .setColor(DANGER_RED)
            .setContentTitle(payload.optString("title", "DANGER ALERT"))
            .setContentText(payload.optString("body", "Move to safety and check THE EYE."))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setVibrate(VIBRATION)
            .setLights(DANGER_RED, 700, 500)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(alertId.hashCode(), notification)
            wakeScreenBriefly(this)
        } catch (_: SecurityException) {
            // Notification permission can be disabled by the wearer.
        }
    }

    private fun isExpired(payload: JSONObject): Boolean {
        val expiresAt = payload.optString("expiresAt")
        if (expiresAt.isEmpty()) return false
        return try {
            java.time.Instant.parse(expiresAt).isBefore(java.time.Instant.now())
        } catch (_: Exception) {
            false
        }
    }

    companion object {
        const val CHANNEL_ID = "theeye_watch_critical_alerts_v2"
        private val VIBRATION = longArrayOf(0, 500, 180, 500, 180, 850)
        private val DANGER_RED = Color.rgb(211, 47, 47)

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Danger alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Urgent nearby danger alerts"
                enableVibration(true)
                vibrationPattern = VIBRATION
                enableLights(true)
                lightColor = DANGER_RED
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                setSound(
                    Settings.System.DEFAULT_ALARM_ALERT_URI,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
            }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        @Suppress("DEPRECATION")
        private fun wakeScreenBriefly(context: Context) {
            val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (power.isInteractive) return
            power.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "theeye-watch:danger-alert",
            ).acquire(5_000)
        }
    }
}
