package com.theeye.watch

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Minimal native fallback when Flutter fails to start repeatedly.
 * Always exposes a safe path back to system settings / default launcher.
 */
class RecoveryActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        container.addView(
            TextView(this).apply {
                text = "THE EYE needs attention"
                textSize = 16f
            },
        )

        container.addView(
            Button(this).apply {
                text = "Open System Settings"
                setOnClickListener {
                    startActivity(
                        Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                }
            },
        )

        container.addView(
            Button(this).apply {
                text = "Change Default Home"
                setOnClickListener {
                    val intent = Intent(Settings.ACTION_HOME_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    if (intent.resolveActivity(packageManager) != null) {
                        startActivity(intent)
                    } else {
                        startActivity(
                            Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    }
                }
            },
        )

        container.addView(
            Button(this).apply {
                text = "Retry THE EYE"
                setOnClickListener {
                    val launch = packageManager.getLaunchIntentForPackage(packageName)
                    if (launch != null) {
                        startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                    finish()
                }
            },
        )

        setContentView(container)
    }
}
