package com.theeye.app.messaging

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.Wearable
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

/**
 * Validates and relays danger-alert FCM data to a paired watch via Wearable MessageClient.
 * Runs without starting a Flutter isolate.
 */
object WatchDangerAlertRelayHandler {
    private const val TAG = "TheEyeWatchRelay"
    const val ALERT_PATH = "/theeye/danger-alert"
    const val ACK_PATH = "/theeye/danger-ack"

    fun canHandle(message: RemoteMessage): Boolean {
        val data = message.data
        val type = data["type"] ?: return false
        if (type != "NearbyDangerWarning") return false
        val relay = data["relayToWatch"]?.lowercase()
        if (relay != "true" && relay != "1") return false
        val code = data["dangerAlertCode"] ?: return false
        return code.startsWith("DANGER_ZONE_")
    }

    fun handle(context: Context, message: RemoteMessage): Boolean {
        if (!canHandle(message)) return false
        val data = message.data
        if (isExpired(data)) {
            Log.i(TAG, "Skipping expired danger alert relay")
            return true
        }
        if (!isSupportedSchema(data)) {
            Log.w(TAG, "Unsupported danger alert schema")
            return true
        }

        val alertId = data["alertId"] ?: return false
        if (WatchDangerAlertRelayStore.wasRelayed(context, alertId, data["alertVersion"])) {
            Log.i(TAG, "Duplicate relay suppressed for alertId=$alertId")
            return true
        }

        val payload = JSONObject(data as Map<*, *>).toString()
        val sent = relayNow(context, payload)
        if (sent) {
            WatchDangerAlertRelayStore.markRelayed(context, alertId, data["alertVersion"])
            Log.i(TAG, "Danger alert relayed to watch")
        } else {
            WatchDangerAlertRelayStore.enqueue(context, payload, alertId, data["expiresAt"])
            Log.i(TAG, "Watch unreachable; queued danger alert relay")
        }
        return true
    }

    fun flushPending(context: Context) {
        val pending = WatchDangerAlertRelayStore.loadPending(context)
        if (pending.isEmpty()) return
        val remaining = mutableListOf<String>()
        for (entry in pending) {
            if (isExpiredJson(entry)) continue
            if (!relayNow(context, entry)) {
                remaining.add(entry)
            }
        }
        WatchDangerAlertRelayStore.savePending(context, remaining)
    }

    private fun relayNow(context: Context, jsonPayload: String): Boolean {
        val nodes = Wearable.getNodeClient(context).connectedNodes
        var sent = false
        val latch = java.util.concurrent.CountDownLatch(1)
        nodes.addOnSuccessListener { connected ->
            if (connected.isEmpty()) {
                latch.countDown()
                return@addOnSuccessListener
            }
            var pending = connected.count { it.isNearby }
            if (pending == 0) {
                latch.countDown()
                return@addOnSuccessListener
            }
            val messageClient = Wearable.getMessageClient(context)
            val payload = jsonPayload.toByteArray(Charsets.UTF_8)
            for (node in connected) {
                if (!node.isNearby) continue
                messageClient.sendMessage(node.id, ALERT_PATH, payload)
                    .addOnSuccessListener {
                        sent = true
                        pending -= 1
                        if (pending <= 0) latch.countDown()
                    }
                    .addOnFailureListener {
                        pending -= 1
                        if (pending <= 0) latch.countDown()
                    }
            }
        }.addOnFailureListener { latch.countDown() }
        latch.await(4, java.util.concurrent.TimeUnit.SECONDS)
        return sent
    }

    private fun isExpired(data: Map<String, String>): Boolean {
        val expiresAt = data["expiresAt"] ?: return false
        return try {
            java.time.Instant.parse(expiresAt).isBefore(java.time.Instant.now())
        } catch (_: Exception) {
            false
        }
    }

    private fun isExpiredJson(json: String): Boolean {
        return try {
            val obj = JSONObject(json)
            val expiresAt = obj.optString("expiresAt")
            if (expiresAt.isEmpty()) return false
            java.time.Instant.parse(expiresAt).isBefore(java.time.Instant.now())
        } catch (_: Exception) {
            false
        }
    }

    private fun isSupportedSchema(data: Map<String, String>): Boolean {
        val version = data["dangerAlertSchemaVersion"]?.toIntOrNull() ?: return false
        return version == 1
    }
}
