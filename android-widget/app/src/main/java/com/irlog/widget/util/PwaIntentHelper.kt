package com.irlog.widget.util

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

object PwaIntentHelper {

    /**
     * Creates an Intent to open the PWA application explicitly on Android.
     * When Chrome handles an Intent with the domain of an installed PWA,
     * it launches the standalone WebAPK / PWA window rather than a generic browser tab.
     */
    fun createPwaOpenIntent(context: Context, url: String): Intent {
        val uri = Uri.parse(url)
        val pm = context.packageManager

        // 1. Check if an installed WebAPK exists on the device
        val webApkPackage = findWebApkPackage(pm, uri.host ?: "")
        if (webApkPackage != null) {
            val launchIntent = pm.getLaunchIntentForPackage(webApkPackage)
            if (launchIntent != null) {
                launchIntent.data = uri
                launchIntent.action = Intent.ACTION_VIEW
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                return launchIntent
            }
        }

        // 2. Target Chrome directly if installed (Chrome will launch the standalone PWA window)
        val chromeIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.android.chrome")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        if (isPackageInstalled(pm, "com.android.chrome")) {
            return chromeIntent
        }

        // 3. Fallback to generic browser intent if Chrome is not installed
        return Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
    }

    private fun findWebApkPackage(pm: PackageManager, host: String): String? {
        try {
            val packages = pm.getInstalledPackages(0)
            for (pkg in packages) {
                val pkgName = pkg.packageName
                if (pkgName.startsWith("org.chromium.webapk")) {
                    return pkgName
                }
            }
        } catch (_: Exception) {
        }
        return null
    }

    private fun isPackageInstalled(pm: PackageManager, packageName: String): Boolean {
        return try {
            pm.getPackageInfo(packageName, 0)
            true
        } catch (_: Exception) {
            false
        }
    }
}
