package com.theeye.app.messaging

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.RemoteMessage
import com.theeye.app.MainActivity
import com.theeye.app.R

object DangerAlertNotifier {
    const val CHANNEL_ID = "the_eye_danger_alerts_v2"
    private val vibrationPattern = longArrayOf(0, 500, 180, 500, 180, 850)

    fun canHandle(message: RemoteMessage): Boolean {
        val data = message.data
        return data["type"] == "NearbyDangerWarning" &&
            data["nativeCriticalAlert"] == "true" &&
            data["dangerAlertCode"]?.startsWith("DANGER_ZONE_") == true
    }

    fun show(context: Context, message: RemoteMessage) {
        if (!canHandle(message) || isExpired(message.data)) return
        ensureChannel(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            action = "FLUTTER_NOTIFICATION_CLICK"
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            message.data.forEach { (key, value) -> putExtra(key, value) }
        }
        val alertId = message.data["alertId"] ?: message.messageId ?: "danger-alert"
        val pendingIntent = PendingIntent.getActivity(
            context,
            alertId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_danger_alert)
            .setColor(Color.rgb(255, 179, 0))
            .setContentTitle(message.data["title"] ?: "Danger alert nearby")
            .setContentText(message.data["body"] ?: "Move to safety and check THE EYE.")
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                message.data["body"] ?: "Move to safety and check THE EYE.",
            ))
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setVibrate(vibrationPattern)
            .setLights(Color.rgb(255, 179, 0), 700, 500)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(alertId.hashCode(), notification)
            wakeScreenBriefly(context)
        } catch (_: SecurityException) {
            // Android 13+ may deny notifications until the user grants permission.
        }
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Danger alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Urgent danger alerts within 4 km"
            enableVibration(true)
            vibrationPattern = DangerAlertNotifier.vibrationPattern
            enableLights(true)
            lightColor = Color.rgb(255, 179, 0)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    @Suppress("DEPRECATION")
    private fun wakeScreenBriefly(context: Context) {
        val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (power.isInteractive) return
        val wakeLock = power.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "theeye:danger-alert",
        )
        wakeLock.acquire(5_000)
    }

    private fun isExpired(data: Map<String, String>): Boolean {
        val expiresAt = data["expiresAt"] ?: return false
        return try {
            java.time.Instant.parse(expiresAt).isBefore(java.time.Instant.now())
        } catch (_: Exception) {
            false
        }
    }
}
