package com.irlog.widget.data.storage

import android.content.Context
import android.content.SharedPreferences
import android.content.res.Configuration
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.irlog.widget.data.model.TodayWorklistResponse
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class SecureTokenStorage(private val context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = try {
        EncryptedSharedPreferences.create(
            context,
            PREFS_FILENAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        context.getSharedPreferences(PREFS_FILENAME, Context.MODE_PRIVATE)
    }

    // Dedicated unencrypted SharedPreferences for UI preferences (theme toggles) to avoid key-wrapper caching delays
    private val uiPrefs: SharedPreferences =
        context.getSharedPreferences(UI_PREFS_FILENAME, Context.MODE_PRIVATE)

    private val json = Json { ignoreUnknownKeys = true }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) {
            val sanitized = value.trim().trimEnd('/')
            prefs.edit().putString(KEY_SERVER_URL, sanitized).commit()
        }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_AUTH_TOKEN, value).commit()
        }

    var username: String?
        get() = prefs.getString(KEY_USERNAME, null)
        set(value) {
            prefs.edit().putString(KEY_USERNAME, value).commit()
        }

    var lastSyncTime: Long
        get() = prefs.getLong(KEY_LAST_SYNC_TIME, 0L)
        set(value) {
            prefs.edit().putLong(KEY_LAST_SYNC_TIME, value).commit()
        }

    var serverUserTheme: String
        get() = uiPrefs.getString(KEY_SERVER_USER_THEME, "light") ?: "light"
        set(value) {
            uiPrefs.edit().putString(KEY_SERVER_USER_THEME, value).commit()
        }

    /**
     * Theme preference options: "user_profile" (default), "light", "dark", "system"
     */
    var themePreference: String
        get() = uiPrefs.getString(KEY_THEME_PREFERENCE, THEME_USER_PROFILE) ?: THEME_USER_PROFILE
        set(value) {
            uiPrefs.edit().putString(KEY_THEME_PREFERENCE, value).commit()
        }

    val isAuthenticated: Boolean
        get() = !authToken.isNullOrBlank() && serverUrl.isNotBlank()

    fun isDarkMode(): Boolean {
        return when (themePreference) {
            THEME_LIGHT -> false
            THEME_DARK -> true
            THEME_SYSTEM -> {
                val currentNightMode = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                currentNightMode == Configuration.UI_MODE_NIGHT_YES
            }
            else -> { // THEME_USER_PROFILE
                serverUserTheme.equals("dark", ignoreCase = true)
            }
        }
    }

    fun toggleDarkMode(): Boolean {
        val currentlyDark = isDarkMode()
        val newTheme = if (currentlyDark) THEME_LIGHT else THEME_DARK
        themePreference = newTheme
        return !currentlyDark
    }

    fun saveCachedWorklist(response: TodayWorklistResponse) {
        val encoded = json.encodeToString(response)
        serverUserTheme = response.userTheme
        prefs.edit()
            .putString(KEY_CACHED_WORKLIST, encoded)
            .putLong(KEY_LAST_SYNC_TIME, System.currentTimeMillis())
            .commit()
    }

    fun getCachedWorklist(): TodayWorklistResponse? {
        val encoded = prefs.getString(KEY_CACHED_WORKLIST, null) ?: return null
        return try {
            json.decodeFromString<TodayWorklistResponse>(encoded)
        } catch (e: Exception) {
            null
        }
    }

    var lastAnalyticsSyncTime: Long
        get() = prefs.getLong(KEY_LAST_ANALYTICS_SYNC_TIME, 0L)
        set(value) {
            prefs.edit().putLong(KEY_LAST_ANALYTICS_SYNC_TIME, value).commit()
        }

    fun shouldSyncAnalyticsDaily(): Boolean {
        val now = System.currentTimeMillis()
        val diff = now - lastAnalyticsSyncTime
        // Sync if never synced or if at least 24 hours have passed
        return diff <= 0 || diff >= 24 * 60 * 60 * 1000L
    }

    fun saveCachedMonthlyTrends(response: com.irlog.widget.data.model.MonthlyTrendsResponse) {
        val encoded = json.encodeToString(response)
        prefs.edit().putString(KEY_CACHED_MONTHLY_TRENDS, encoded).commit()
    }

    fun getCachedMonthlyTrends(): com.irlog.widget.data.model.MonthlyTrendsResponse? {
        val encoded = prefs.getString(KEY_CACHED_MONTHLY_TRENDS, null) ?: return null
        return try {
            json.decodeFromString<com.irlog.widget.data.model.MonthlyTrendsResponse>(encoded)
        } catch (_: Exception) {
            null
        }
    }

    fun saveCachedCumulativeMonthly(response: com.irlog.widget.data.model.CumulativeMonthlyResponse) {
        val encoded = json.encodeToString(response)
        prefs.edit().putString(KEY_CACHED_CUMULATIVE_MONTHLY, encoded).commit()
    }

    fun getCachedCumulativeMonthly(): com.irlog.widget.data.model.CumulativeMonthlyResponse? {
        val encoded = prefs.getString(KEY_CACHED_CUMULATIVE_MONTHLY, null) ?: return null
        return try {
            json.decodeFromString<com.irlog.widget.data.model.CumulativeMonthlyResponse>(encoded)
        } catch (_: Exception) {
            null
        }
    }

    fun saveCachedCumulativeYearly(response: com.irlog.widget.data.model.CumulativeYearlyResponse) {
        val encoded = json.encodeToString(response)
        prefs.edit().putString(KEY_CACHED_CUMULATIVE_YEARLY, encoded).commit()
    }

    fun getCachedCumulativeYearly(): com.irlog.widget.data.model.CumulativeYearlyResponse? {
        val encoded = prefs.getString(KEY_CACHED_CUMULATIVE_YEARLY, null) ?: return null
        return try {
            json.decodeFromString<com.irlog.widget.data.model.CumulativeYearlyResponse>(encoded)
        } catch (_: Exception) {
            null
        }
    }

    fun clearAuth() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USERNAME)
            .remove(KEY_CACHED_WORKLIST)
            .remove(KEY_LAST_SYNC_TIME)
            .remove(KEY_CACHED_MONTHLY_TRENDS)
            .remove(KEY_CACHED_CUMULATIVE_MONTHLY)
            .remove(KEY_CACHED_CUMULATIVE_YEARLY)
            .remove(KEY_LAST_ANALYTICS_SYNC_TIME)
            .commit()
        uiPrefs.edit()
            .remove(KEY_SERVER_USER_THEME)
            .commit()
    }

    /**
     * Configurable work hours for dynamic sync scheduling (default: 08:00 to 20:00)
     */
    var workHoursStartHour: Int
        get() = uiPrefs.getInt(KEY_WORK_START_HOUR, 8)
        set(value) { uiPrefs.edit().putInt(KEY_WORK_START_HOUR, value).commit() }

    var workHoursStartMinute: Int
        get() = uiPrefs.getInt(KEY_WORK_START_MINUTE, 0)
        set(value) { uiPrefs.edit().putInt(KEY_WORK_START_MINUTE, value).commit() }

    var workHoursEndHour: Int
        get() = uiPrefs.getInt(KEY_WORK_END_HOUR, 20)
        set(value) { uiPrefs.edit().putInt(KEY_WORK_END_HOUR, value).commit() }

    var workHoursEndMinute: Int
        get() = uiPrefs.getInt(KEY_WORK_END_MINUTE, 0)
        set(value) { uiPrefs.edit().putInt(KEY_WORK_END_MINUTE, value).commit() }

    companion object {
        private const val PREFS_FILENAME = "irlog_secure_widget_prefs"
        private const val UI_PREFS_FILENAME = "irlog_ui_widget_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USERNAME = "username"
        private const val KEY_CACHED_WORKLIST = "cached_worklist"
        private const val KEY_LAST_SYNC_TIME = "last_sync_time"
        private const val KEY_LAST_ANALYTICS_SYNC_TIME = "last_analytics_sync_time"
        private const val KEY_CACHED_MONTHLY_TRENDS = "cached_monthly_trends"
        private const val KEY_CACHED_CUMULATIVE_MONTHLY = "cached_cumulative_monthly"
        private const val KEY_CACHED_CUMULATIVE_YEARLY = "cached_cumulative_yearly"
        private const val KEY_SERVER_USER_THEME = "server_user_theme"
        private const val KEY_THEME_PREFERENCE = "theme_preference"
        private const val KEY_WORK_START_HOUR = "work_start_hour"
        private const val KEY_WORK_START_MINUTE = "work_start_minute"
        private const val KEY_WORK_END_HOUR = "work_end_hour"
        private const val KEY_WORK_END_MINUTE = "work_end_minute"

        const val THEME_USER_PROFILE = "user_profile"
        const val THEME_LIGHT = "light"
        const val THEME_DARK = "dark"
        const val THEME_SYSTEM = "system"
    }
}
