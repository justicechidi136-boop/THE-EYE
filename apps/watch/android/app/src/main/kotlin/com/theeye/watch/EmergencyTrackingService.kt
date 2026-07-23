package com.theeye.watch

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground emergency tracking for full-Android watch targets (Target B).
 * Wear OS uses persisted state + boot recovery without forcing this service.
 */
class EmergencyTrackingService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                if (!isAuthorizedStart(intent)) {
                    logDiagnostic("rejected_unauthorized_start")
                    stopSelf()
                    return START_NOT_STICKY
                }
                if (isWearOs()) {
                    persistState(intent)
                    logDiagnostic("wear_persist_only")
                    stopSelf()
                    return START_NOT_STICKY
                }
                val silent = intent.getBooleanExtra(EXTRA_SILENT, false)
                val sosEventId = intent.getStringExtra(EXTRA_SOS_EVENT_ID)
                val incidentId = intent.getStringExtra(EXTRA_INCIDENT_ID)
                persistState(intent)
                startForegroundWithType(buildNotification(silent), sosEventId, incidentId)
                acquireShortWakeLock()
                logDiagnostic("started")
            }
            ACTION_STOP -> {
                releaseWakeLock()
                clearPersistedState()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                logDiagnostic("stopped")
            }
            ACTION_RESTORE -> {
                if (isWearOs()) {
                    logDiagnostic("wear_restore_skip_fg")
                    stopSelf()
                    return START_NOT_STICKY
                }
                val state = readPersistedState()
                if (state == null || !state.active) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                startForegroundWithType(
                    buildNotification(state.silent),
                    state.sosEventId,
                    state.incidentId,
                )
                logDiagnostic("restored")
            }
            else -> stopSelf()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun isAuthorizedStart(intent: Intent): Boolean {
        return intent.getBooleanExtra(EXTRA_AUTHORIZED, false)
    }

    private fun isWearOs(): Boolean {
        return packageManager.hasSystemFeature(PackageManager.FEATURE_WATCH)
    }

    private fun startForegroundWithType(
        notification: Notification,
        sosEventId: String?,
        incidentId: String?,
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        Log.i(
            TAG,
            "emergency_fg_active sosEventId=${sanitize(sosEventId)} incidentId=${sanitize(incidentId)}",
        )
    }

    private fun buildNotification(silent: Boolean): Notification {
        val launchIntent = Intent(this, LauncherHomeActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = if (silent) {
            "Discreet emergency active"
        } else {
            "Emergency tracking active"
        }
        val body = if (silent) {
            "Location sync continues. Mandatory system indicator shown."
        } else {
            "THE EYE is sharing your location with command center."
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Emergency tracking",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Shows while an SOS or emergency location stream is active"
            setShowBadge(false)
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(channel)
    }

    private fun acquireShortWakeLock() {
        releaseWakeLock()
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "theeye:emergency_sync",
        ).apply {
            acquire(SHORT_WAKE_LOCK_MS)
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }

    private fun persistState(intent: Intent) {
        prefs().edit()
            .putBoolean(KEY_ACTIVE, true)
            .putString(KEY_SOS_EVENT_ID, intent.getStringExtra(EXTRA_SOS_EVENT_ID))
            .putString(KEY_INCIDENT_ID, intent.getStringExtra(EXTRA_INCIDENT_ID))
            .putBoolean(KEY_SILENT, intent.getBooleanExtra(EXTRA_SILENT, false))
            .putLong(KEY_STARTED_AT, System.currentTimeMillis())
            .apply()
    }

    private fun clearPersistedState() {
        prefs().edit().clear().apply()
    }

    private fun readPersistedState(): PersistedEmergencyState? {
        val store = prefs()
        if (!store.getBoolean(KEY_ACTIVE, false)) return null
        return PersistedEmergencyState(
            active = true,
            sosEventId = store.getString(KEY_SOS_EVENT_ID, null),
            incidentId = store.getString(KEY_INCIDENT_ID, null),
            silent = store.getBoolean(KEY_SILENT, false),
        )
    }

    private fun prefs() =
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun logDiagnostic(event: String) {
        Log.i(TAG, "diagnostic event=$event wear=${isWearOs()}")
    }

    private fun sanitize(value: String?): String {
        if (value.isNullOrBlank()) return "none"
        return if (value.length <= 8) "redacted" else "${value.take(4)}…"
    }

    data class PersistedEmergencyState(
        val active: Boolean,
        val sosEventId: String?,
        val incidentId: String?,
        val silent: Boolean,
    )

    companion object {
        private const val TAG = "EmergencyTracking"
        const val CHANNEL_ID = "emergency_tracking"
        const val NOTIFICATION_ID = 7001
        const val ACTION_START = "com.theeye.watch.emergency.START"
        const val ACTION_STOP = "com.theeye.watch.emergency.STOP"
        const val ACTION_RESTORE = "com.theeye.watch.emergency.RESTORE"
        const val EXTRA_SOS_EVENT_ID = "sosEventId"
        const val EXTRA_INCIDENT_ID = "incidentId"
        const val EXTRA_SILENT = "silent"
        const val EXTRA_AUTHORIZED = "authorized"
        const val PREFS_NAME = "emergency_service_state"
        const val KEY_ACTIVE = "active"
        const val KEY_SOS_EVENT_ID = "sosEventId"
        const val KEY_INCIDENT_ID = "incidentId"
        const val KEY_SILENT = "silent"
        const val KEY_STARTED_AT = "startedAt"
        private const val SHORT_WAKE_LOCK_MS = 30_000L

        fun startAuthorized(
            context: Context,
            sosEventId: String?,
            incidentId: String?,
            silent: Boolean,
        ) {
            val intent = Intent(context, EmergencyTrackingService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_AUTHORIZED, true)
                putExtra(EXTRA_SOS_EVENT_ID, sosEventId)
                putExtra(EXTRA_INCIDENT_ID, incidentId)
                putExtra(EXTRA_SILENT, silent)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, EmergencyTrackingService::class.java).apply {
                    action = ACTION_STOP
                },
            )
        }

        fun restoreIfNeeded(context: Context) {
            val store = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!store.getBoolean(KEY_ACTIVE, false)) return
            val intent = Intent(context, EmergencyTrackingService::class.java).apply {
                action = ACTION_RESTORE
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !context.packageManager.hasSystemFeature(PackageManager.FEATURE_WATCH)
            ) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun isActive(context: Context): Boolean {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_ACTIVE, false)
        }
    }
}
