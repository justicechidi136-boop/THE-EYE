package com.theeye.watch

import android.app.Activity
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class LauncherChannelHandler(
    private val activity: Activity,
    private val packageName: String,
) : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isDefaultHome" -> result.success(isDefaultHome())
            "requestDefaultHome" -> {
                requestDefaultHome()
                result.success(null)
            }
            "openHomeSettings" -> {
                openHomeSettings()
                result.success(null)
            }
            "openSystemSettings" -> {
                openSystemSettings()
                result.success(null)
            }
            "listApps" -> result.success(listLaunchableApps())
            "launchApp" -> {
                val pkg = call.argument<String>("packageName")
                if (pkg.isNullOrBlank()) {
                    result.error("invalid_args", "packageName required", null)
                } else {
                    result.success(launchApp(pkg))
                }
            }
            "getLauncherMode" -> result.success(BuildConfig.LAUNCHER_MODE)
            "isDebugBuild" -> result.success(BuildConfig.DEBUG)
            "isManagedBuild" -> result.success(BuildConfig.LAUNCHER_MODE == "managed")
            else -> result.notImplemented()
        }
    }

    private fun isDefaultHome(): Boolean {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolveInfo = activity.packageManager.resolveActivity(
            intent,
            PackageManager.MATCH_DEFAULT_ONLY,
        ) ?: return false
        val defaultHome = resolveInfo.activityInfo?.packageName
        return defaultHome == packageName
    }

    private fun requestDefaultHome() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = activity.getSystemService(RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_HOME)) {
                if (!roleManager.isRoleHeld(RoleManager.ROLE_HOME)) {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_HOME)
                    activity.startActivity(intent)
                    return
                }
            }
        }
        openHomeSettings()
    }

    private fun openHomeSettings() {
        val intents = listOf(
            Intent(Settings.ACTION_HOME_SETTINGS),
            Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
            Intent(Settings.ACTION_SETTINGS),
        )
        for (intent in intents) {
            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            }
        }
    }

    private fun openSystemSettings() {
        val intent = Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(activity.packageManager) != null) {
            activity.startActivity(intent)
        }
    }

    private fun listLaunchableApps(): List<Map<String, String?>> {
        val pm = activity.packageManager
        val launcherIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val activities = pm.queryIntentActivities(launcherIntent, PackageManager.MATCH_ALL)
        val seen = linkedSetOf<String>()
        val apps = mutableListOf<Map<String, String?>>()

        fun addApp(pkg: String, labelOverride: String? = null) {
            if (!seen.add(pkg)) return
            try {
                val info = pm.getApplicationInfo(pkg, 0)
                val label = labelOverride ?: pm.getApplicationLabel(info).toString()
                apps.add(
                    mapOf(
                        "packageName" to pkg,
                        "label" to label,
                        "systemApp" to info.isSystemApp().toString(),
                    ),
                )
            } catch (_: PackageManager.NameNotFoundException) {
                // Skip missing packages.
            }
        }

        for (resolve in activities) {
            addApp(resolve.activityInfo.packageName)
        }

        // Ensure escape hatches are always listed when installed.
        addApp("com.google.android.apps.wearable.settings", "Settings")
        addApp("com.google.android.dialer", "Phone")
        addApp(packageName, "THE EYE")

        return apps.sortedBy { it["label"]?.lowercase() }
    }

    private fun launchApp(targetPackage: String): Boolean {
        val pm = activity.packageManager
        val launchIntent = pm.getLaunchIntentForPackage(targetPackage)
            ?: Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                `package` = targetPackage
            }
        return try {
            activity.startActivity(launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun ApplicationInfo.isSystemApp(): Boolean {
        val flags = flags
        return (flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
            (flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
    }
}
