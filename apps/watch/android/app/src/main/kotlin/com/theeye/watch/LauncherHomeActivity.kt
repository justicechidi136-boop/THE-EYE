package com.theeye.watch

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.plugin.common.MethodChannel

open class LauncherHomeActivity : FlutterActivity() {

    private val vibrationChannel = "com.theeye.watch/vibration"
    private val launcherChannel = "com.theeye.watch/launcher"
    private val crashChannel = "com.theeye.watch/crash"

    override fun provideFlutterEngine(context: Context): FlutterEngine? {
        return FlutterEngineCache.getInstance().get(FLUTTER_ENGINE_ID)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        FlutterEngineCache.getInstance().put(FLUTTER_ENGINE_ID, flutterEngine)
        CrashSentinel.reset(this)
        ManagedLauncherStub.noteManagedBoot(this)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, vibrationChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "pulse" -> {
                        vibrate(120)
                        result.success(null)
                    }
                    "confirmSos" -> {
                        vibrate(300)
                        result.success(null)
                    }
                    "cancel" -> {
                        cancelVibration()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, launcherChannel)
            .setMethodCallHandler(
                LauncherChannelHandler(this, packageName),
            )

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, crashChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "recordFlutterCrash" -> {
                        CrashSentinel.recordFlutterCrash(this)
                        result.success(null)
                    }
                    "resetCrashCount" -> {
                        CrashSentinel.reset(this)
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun vibrator(): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
    }

    private fun vibrate(durationMs: Long) {
        val vibrator = vibrator() ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(
                VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE),
            )
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(durationMs)
        }
    }

    private fun cancelVibration() {
        vibrator()?.cancel()
    }

    companion object {
        const val FLUTTER_ENGINE_ID = "theeye_watch_engine"
    }
}
