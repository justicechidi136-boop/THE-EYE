package com.theeye.fieldops

import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            FieldLauncherBridge.CHANNEL,
        ).setMethodCallHandler(FieldLauncherBridge(this))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val mode = BuildConfig.FIELD_DEVICE_MODE.lowercase()
        if (mode == "launcher" || mode == "managed_kiosk") {
            try {
                val alias = ComponentName(this, "${packageName}.LauncherHomeAlias")
                packageManager.setComponentEnabledSetting(
                    alias,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP,
                )
            } catch (_: Exception) {
                // Alias may already be enabled.
            }
        }
    }
}
