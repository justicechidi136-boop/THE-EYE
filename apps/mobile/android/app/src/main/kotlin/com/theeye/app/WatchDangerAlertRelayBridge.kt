package com.theeye.app

import android.app.Activity
import com.google.android.gms.wearable.Wearable
import io.flutter.plugin.common.MethodChannel

class WatchDangerAlertRelayBridge(private val activity: Activity) {
    fun relayDangerAlert(jsonPayload: String, callback: (Boolean) -> Unit) {
        val nodeClient = Wearable.getNodeClient(activity)
        nodeClient.connectedNodes.addOnSuccessListener { nodes ->
            if (nodes.isEmpty()) {
                callback(false)
                return@addOnSuccessListener
            }
            val messageClient = Wearable.getMessageClient(activity)
            val payload = jsonPayload.toByteArray(Charsets.UTF_8)
            var sent = false
            var pending = nodes.count { it.isNearby }
            if (pending == 0) {
                callback(false)
                return@addOnSuccessListener
            }
            for (node in nodes) {
                if (!node.isNearby) continue
                messageClient
                    .sendMessage(node.id, ALERT_PATH, payload)
                    .addOnSuccessListener {
                        sent = true
                        pending -= 1
                        if (pending <= 0) callback(sent)
                    }
                    .addOnFailureListener {
                        pending -= 1
                        if (pending <= 0) callback(sent)
                    }
            }
        }.addOnFailureListener {
            callback(false)
        }
    }

    fun relayAcknowledgement(alertId: String) {
        val nodeClient = Wearable.getNodeClient(activity)
        nodeClient.connectedNodes.addOnSuccessListener { nodes ->
            val payload = alertId.toByteArray(Charsets.UTF_8)
            val messageClient = Wearable.getMessageClient(activity)
            for (node in nodes) {
                if (node.isNearby) {
                    messageClient.sendMessage(node.id, ACK_PATH, payload)
                }
            }
        }
    }

    fun isWatchReachable(callback: (Boolean) -> Unit) {
        Wearable.getNodeClient(activity).connectedNodes
            .addOnSuccessListener { nodes -> callback(nodes.any { it.isNearby }) }
            .addOnFailureListener { callback(false) }
    }

    companion object {
        const val CHANNEL = "com.theeye.app/watch_danger_relay"
        const val ALERT_PATH = "/theeye/danger-alert"
        const val ACK_PATH = "/theeye/danger-ack"
    }
}
