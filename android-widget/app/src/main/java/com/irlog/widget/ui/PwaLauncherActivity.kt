package com.irlog.widget.ui

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity

/**
 * Transparent trampoline activity that routes widget taps to the installed PWA.
 *
 * Detection priority:
 *  1. Find a Chrome WebAPK whose registered scope matches the target URL's host.
 *  2. If no WebAPK, query all intent handlers for the URL and pick any non-browser
 *     handler (e.g. a TWA wrapper).
 *  3. Fallback: open in Chrome (will open as a regular tab).
 *  4. Last resort: system default browser.
 */
class PwaLauncherActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_URL = "extra_target_url"
        private const val TAG = "PwaLauncher"

        // Known browser package names to exclude when searching for PWA handlers
        private val BROWSER_PACKAGES = setOf(
            "com.android.chrome",
            "com.chrome.beta",
            "com.chrome.dev",
            "com.chrome.canary",
            "org.mozilla.firefox",
            "org.mozilla.firefox_beta",
            "com.opera.browser",
            "com.opera.mini.native",
            "com.brave.browser",
            "com.microsoft.emmx",
            "com.sec.android.app.sbrowser",
            "com.UCMobile.intl",
            "com.kiwibrowser.browser",
            "com.vivaldi.browser",
            "com.duckduckgo.mobile.android",
            "org.bromite.bromite",
            "com.ecosia.android"
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val targetUrl = intent.getStringExtra(EXTRA_URL) ?: intent.dataString

        if (!targetUrl.isNullOrBlank()) {
            val uri = Uri.parse(targetUrl)
            Log.d(TAG, "Launching PWA for: $targetUrl")
            launchPwa(uri)
        } else {
            Log.w(TAG, "No target URL received")
        }

        finish()
    }

    private fun launchPwa(uri: Uri) {
        val targetHost = uri.host ?: ""

        // ── Strategy 1: Find WebAPK by scanning installed packages ──
        val webApkPackage = findWebApkForHost(targetHost)
        if (webApkPackage != null) {
            Log.d(TAG, "Found WebAPK: $webApkPackage")
            val webApkIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage(webApkPackage)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            try {
                startActivity(webApkIntent)
                return
            } catch (e: Exception) {
                Log.w(TAG, "WebAPK launch failed: ${e.message}")
            }

            // Also try the launch intent (opens start_url, then the PWA handles navigation)
            val launchIntent = packageManager.getLaunchIntentForPackage(webApkPackage)
            if (launchIntent != null) {
                launchIntent.data = uri
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                try {
                    startActivity(launchIntent)
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "WebAPK launch-intent failed: ${e.message}")
                }
            }
        }

        // ── Strategy 2: Query intent handlers and find non-browser match ──
        val viewIntent = Intent(Intent.ACTION_VIEW, uri)
        try {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PackageManager.MATCH_ALL else 0
            val handlers = packageManager.queryIntentActivities(viewIntent, flags)

            for (handler in handlers) {
                val pkg = handler.activityInfo.packageName
                // Skip known browsers and our own app
                if (pkg in BROWSER_PACKAGES || pkg == packageName ||
                    pkg.contains("browser", ignoreCase = true)) continue

                // This is likely a WebAPK or TWA – launch it
                Log.d(TAG, "Found non-browser handler: $pkg / ${handler.activityInfo.name}")
                val pwaIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    component = ComponentName(pkg, handler.activityInfo.name)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                try {
                    startActivity(pwaIntent)
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "Non-browser handler launch failed: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "queryIntentActivities failed: ${e.message}")
        }

        // ── Strategy 3: Open in Chrome (regular tab fallback) ──
        val chromeIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.android.chrome")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        try {
            startActivity(chromeIntent)
            return
        } catch (_: Exception) {
            Log.w(TAG, "Chrome not available")
        }

        // ── Strategy 4: System default browser ──
        val fallbackIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        try {
            startActivity(fallbackIntent)
        } catch (_: Exception) {
            Log.e(TAG, "No browser available at all")
        }
    }

    /**
     * Scans all installed packages for a Chrome WebAPK that serves [targetHost].
     *
     * Chrome WebAPKs are real APKs with package names starting with "org.chromium.webapk".
     * Each WebAPK has a meta-data entry "org.chromium.webapk.shell_apk.startUrl" in its
     * manifest that contains the PWA start URL. We match the host of that start URL
     * against [targetHost].
     *
     * Falls back to returning the first WebAPK found if meta-data parsing fails
     * (better than nothing).
     */
    private fun findWebApkForHost(targetHost: String): String? {
        try {
            val packages = packageManager.getInstalledPackages(PackageManager.GET_META_DATA)
            var firstWebApk: String? = null

            for (pkg in packages) {
                val pkgName = pkg.packageName ?: continue

                if (!pkgName.startsWith("org.chromium.webapk")) continue

                // Remember first WebAPK as fallback
                if (firstWebApk == null) firstWebApk = pkgName

                // Try to match the WebAPK's start URL host against our target host
                val metaData = pkg.applicationInfo?.metaData ?: continue
                val startUrl = metaData.getString("org.chromium.webapk.shell_apk.startUrl")
                    ?: metaData.getString("org.chromium.webapk.shell_apk.scope")

                if (startUrl != null) {
                    val webApkHost = Uri.parse(startUrl).host ?: continue
                    Log.d(TAG, "WebAPK $pkgName serves host: $webApkHost")
                    if (webApkHost.equals(targetHost, ignoreCase = true)) {
                        return pkgName
                    }
                }
            }

            // If we found WebAPK(s) but none matched by host, return the first one
            // (user likely has only one PWA installed)
            if (firstWebApk != null) {
                Log.d(TAG, "Using first WebAPK as fallback: $firstWebApk")
                return firstWebApk
            }
        } catch (e: Exception) {
            Log.w(TAG, "WebAPK scan failed: ${e.message}")
        }
        return null
    }
}
