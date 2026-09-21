package com.irlog.widget.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import com.irlog.widget.data.storage.SecureTokenStorage

/**
 * Lightweight translucent activity that directly initiates the 1-tap passkey/session
 * handshake from the home screen widget without displaying the technical SettingsActivity.
 */
class WidgetAuthRedirectActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val storage = SecureTokenStorage(this)
        val serverUrl = if (storage.serverUrl.isNotBlank()) {
            storage.serverUrl
        } else {
            IRLogTwaLauncherActivity.DEFAULT_URL
        }.trimEnd('/')

        val authUri = Uri.parse("$serverUrl/widget-auth/")
        val browserPackage = getBrowserPackage(authUri)

        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()

            if (browserPackage != null) {
                customTabsIntent.intent.setPackage(browserPackage)
            }
            customTabsIntent.launchUrl(this, authUri)
        } catch (e: Exception) {
            try {
                val browserIntent = Intent(Intent.ACTION_VIEW, authUri).apply {
                    if (browserPackage != null) {
                        setPackage(browserPackage)
                    }
                }
                startActivity(browserIntent)
            } catch (ex: Exception) {
                Toast.makeText(this, "Could not open auth: ${ex.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
        finish()
    }

    private fun getBrowserPackage(uri: Uri): String? {
        return try {
            val pm = packageManager
            val browserIntent = Intent(Intent.ACTION_VIEW, uri)
            val resolved = pm.queryIntentActivities(browserIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            for (info in resolved) {
                val pkg = info.activityInfo.packageName
                if (pkg != packageName) {
                    return pkg
                }
            }
            pm.getPackageInfo("com.android.chrome", 0)
            "com.android.chrome"
        } catch (_: Exception) {
            "com.android.chrome"
        }
    }
}
