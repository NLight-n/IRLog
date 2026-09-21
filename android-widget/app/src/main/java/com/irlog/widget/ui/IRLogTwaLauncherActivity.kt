package com.irlog.widget.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.google.androidbrowserhelper.trusted.LauncherActivity
import com.irlog.widget.data.storage.SecureTokenStorage

/**
 * Trusted Web Activity (TWA) Launcher for IRLog.
 * - On fresh install (unauthenticated): Redirects to SettingsActivity.
 * - On subsequent launches: Launches the full IRLog web app in chromeless full-screen mode.
 * - On widget case click: Opens the specific case URL directly inside the TWA container.
 */
class IRLogTwaLauncherActivity : LauncherActivity() {

    private lateinit var storage: SecureTokenStorage

    override fun onCreate(savedInstanceState: Bundle?) {
        storage = SecureTokenStorage(this)
        super.onCreate(savedInstanceState)
    }

    override fun getLaunchingUrl(): Uri {
        // 1. Check if intent has a specific target URL (e.g., from a widget procedure click)
        val targetUrl = intent?.getStringExtra(EXTRA_TARGET_URL)
        if (!targetUrl.isNullOrBlank()) {
            return Uri.parse(targetUrl)
        }

        // 2. Otherwise open the user-configured server URL or production default
        val base = if (storage.serverUrl.isNotBlank()) {
            storage.serverUrl
        } else {
            DEFAULT_URL
        }
        return Uri.parse(base)
    }

    companion object {
        const val EXTRA_TARGET_URL = "target_url"
        const val DEFAULT_URL = "https://claritymdt.snhrc.org/irlog"
    }
}
