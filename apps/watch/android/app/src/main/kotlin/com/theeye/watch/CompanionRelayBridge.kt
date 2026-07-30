package com.theeye.watch

import android.app.Activity
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import io.flutter.plugin.common.MethodChannel

class CompanionRelayBridge(
    private val activity: Activity,
    private val channel: MethodChannel,
) : MessageClient.OnMessageReceivedListener {

    private var listening = false

    fun startListening() {
        if (listening) return
        Wearable.getMessageClient(activity).addListener(this)
        listening = true
    }

    fun stopListening() {
        if (!listening) return
        Wearable.getMessageClient(activity).removeListener(this)
        listening = false
    }

    fun sendAcknowledgement(alertId: String) {
        Wearable.getNodeClient(activity).connectedNodes.addOnSuccessListener { nodes ->
            val payload = alertId.toByteArray(Charsets.UTF_8)
            val messageClient = Wearable.getMessageClient(activity)
            for (node in nodes) {
                if (node.isNearby) {
                    messageClient.sendMessage(node.id, ACK_PATH, payload)
                }
            }
        }
    }

    fun isPhoneReachable(callback: (Boolean) -> Unit) {
        Wearable.getNodeClient(activity).connectedNodes
            .addOnSuccessListener { nodes -> callback(nodes.any { it.isNearby }) }
            .addOnFailureListener { callback(false) }
    }

    override fun onMessageReceived(event: com.google.android.gms.wearable.MessageEvent) {
        when (event.path) {
            ALERT_PATH -> {
                val json = String(event.data, Charsets.UTF_8)
                activity.runOnUiThread {
                    channel.invokeMethod("dangerAlert", json)
                }
            }
            ACK_PATH -> {
                val alertId = String(event.data, Charsets.UTF_8)
                activity.runOnUiThread {
                    channel.invokeMethod("dangerAck", alertId)
                }
            }
        }
    }

    companion object {
        const val ALERT_PATH = "/theeye/danger-alert"
        const val ACK_PATH = "/theeye/danger-ack"
    }
}

class AudioOutputBridge(private val context: Context) {
    fun isHeadphoneConnected(): Boolean {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            return devices.any { device ->
                when (device.type) {
                    AudioDeviceInfo.TYPE_WIRED_HEADSET,
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                    -> true
                    else -> false
                }
            }
        }
        @Suppress("DEPRECATION")
        return audioManager.isBluetoothA2dpOn || audioManager.isWiredHeadsetOn
    }
}
