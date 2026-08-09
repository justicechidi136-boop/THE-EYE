package com.theeye.fieldops

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Native bridge for FIELD_DEVICE_MODE launcher / managed-kiosk capabilities.
 * Never silently elevates to Device Owner.
 */
class FieldLauncherBridge(
    private val activity: Activity,
) : MethodChannel.MethodCallHandler {

    private val packageManager: PackageManager get() = activity.packageManager
    private val devicePolicyManager: DevicePolicyManager
        get() = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val adminComponent = ComponentName(activity, FieldDeviceAdminReceiver::class.java)
    private val homeAlias = ComponentName(activity, "${activity.packageName}.LauncherHomeAlias")

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "getBuildDeviceMode" -> result.success(BuildConfig.FIELD_DEVICE_MODE)
                "getCapabilities" -> result.success(capabilities())
                "setHomeAliasEnabled" -> {
                    val enabled = call.argument<Boolean>("enabled") == true
                    setHomeAliasEnabled(enabled)
                    result.success(true)
                }
                "isPackageInstalled" -> {
                    val packageName = call.argument<String>("packageName")
                    if (packageName.isNullOrBlank()) {
                        result.error("bad_args", "packageName required", null)
                    } else {
                        result.success(isPackageInstalled(packageName))
                    }
                }
                "launchApprovedPackage" -> {
                    val packageName = call.argument<String>("packageName")
                    if (packageName.isNullOrBlank()) {
                        result.error("bad_args", "packageName required", null)
                        return
                    }
                    result.success(launchPackage(packageName))
                }
                "startLockTask" -> {
                    result.success(startLockTask())
                }
                "stopLockTask" -> {
                    result.success(stopLockTask())
                }
                "setLockTaskPackages" -> {
                    @Suppress("UNCHECKED_CAST")
                    val packages = call.argument<List<String>>("packages") ?: emptyList()
                    result.success(setLockTaskPackages(packages))
                }
                "openHomeSettings" -> {
                    activity.startActivity(
                        Intent(Settings.ACTION_HOME_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                    result.success(true)
                }
                "openEmergencyDialer" -> {
                    val number = call.argument<String>("number") ?: "112"
                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    activity.startActivity(intent)
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        } catch (error: Exception) {
            result.error("bridge_error", error.message, null)
        }
    }

    private fun capabilities(): Map<String, Any?> {
        val dpm = devicePolicyManager
        val isAdmin = dpm.isAdminActive(adminComponent)
        val isOwner = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            dpm.isDeviceOwnerApp(activity.packageName)
        } else {
            false
        }
        val isProfileOwner = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            dpm.isProfileOwnerApp(activity.packageName)
        } else {
            false
        }
        val lockTaskMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            am.lockTaskModeState
        } else {
            ActivityManager.LOCK_TASK_MODE_NONE
        }
        return mapOf(
            "buildDeviceMode" to BuildConfig.FIELD_DEVICE_MODE,
            "isDeviceAdmin" to isAdmin,
            "isDeviceOwner" to isOwner,
            "isProfileOwner" to isProfileOwner,
            "lockTaskModeState" to lockTaskMode,
            "homeAliasEnabled" to isHomeAliasEnabled(),
            "packageName" to activity.packageName,
        )
    }

    private fun setHomeAliasEnabled(enabled: Boolean) {
        val state = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        packageManager.setComponentEnabledSetting(
            homeAlias,
            state,
            PackageManager.DONT_KILL_APP,
        )
    }

    private fun isHomeAliasEnabled(): Boolean {
        return when (packageManager.getComponentEnabledSetting(homeAlias)) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED -> false
            else -> false
        }
    }

    private fun isPackageInstalled(packageName: String): Boolean {
        return try {
            packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }
    }

    private fun launchPackage(packageName: String): Boolean {
        val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return false
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(launch)
        return true
    }

    private fun startLockTask(): Boolean {
        return try {
            activity.startLockTask()
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun stopLockTask(): Boolean {
        return try {
            activity.stopLockTask()
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun setLockTaskPackages(packages: List<String>): Boolean {
        if (!devicePolicyManager.isDeviceOwnerApp(activity.packageName)) {
            return false
        }
        val merged = (packages + activity.packageName).distinct().toTypedArray()
        devicePolicyManager.setLockTaskPackages(adminComponent, merged)
        return true
    }

    companion object {
        const val CHANNEL = "the_eye_field_ops/launcher"
    }
}
