package com.theeye.watch

/**
 * Managed launcher hooks — device-owner provisioning only in managed flavors.
 * Consumer builds must never call DevicePolicyManager lock-task APIs.
 */
object ManagedLauncherStub {
    fun isManagedBuild(): Boolean = BuildConfig.LAUNCHER_MODE == "managed"

    fun noteManagedBoot(context: android.content.Context) {
        if (!isManagedBuild()) return
        // Reserved for managed boot policy wiring (no DPM in consumer).
        CrashSentinel.reset(context)
    }
}
