package com.theeye.app.messaging

import android.content.Context

object WatchDangerAlertRelayStore {
    private const val PREFS = "theeye_watch_danger_relay"
    private const val KEY_PENDING = "pending_payloads"
    private const val KEY_RELAYED = "relayed_alert_ids"

    fun enqueue(context: Context, payload: String, alertId: String, expiresAt: String?) {
        val pending = loadPending(context).toMutableList()
        pending.add(payload)
        savePending(context, pending)
    }

    fun loadPending(context: Context): List<String> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getStringSet(KEY_PENDING, emptySet())?.toList() ?: emptyList()
    }

    fun savePending(context: Context, payloads: List<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_PENDING, payloads.toSet())
            .apply()
    }

    fun wasRelayed(context: Context, alertId: String, version: String?): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = relayKey(alertId, version)
        return prefs.getStringSet(KEY_RELAYED, emptySet())?.contains(key) == true
    }

    fun markRelayed(context: Context, alertId: String, version: String?) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = prefs.getStringSet(KEY_RELAYED, emptySet())?.toMutableSet() ?: mutableSetOf()
        existing.add(relayKey(alertId, version))
        prefs.edit().putStringSet(KEY_RELAYED, existing).apply()
    }

    private fun relayKey(alertId: String, version: String?): String =
        "$alertId-v${version ?: "1"}"
}
