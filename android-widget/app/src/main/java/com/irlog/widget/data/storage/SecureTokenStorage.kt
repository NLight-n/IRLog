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
        // Fallback to standard prefs if crypto provider fails
        context.getSharedPreferences(PREFS_FILENAME, Context.MODE_PRIVATE)
    }

    private val json = Json { ignoreUnknownKeys = true }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) {
            val sanitized = value.trim().trimEnd('/')
            prefs.edit().putString(KEY_SERVER_URL, sanitized).apply()
        }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    var username: String?
        get() = prefs.getString(KEY_USERNAME, null)
        set(value) = prefs.edit().putString(KEY_USERNAME, value).apply()

    var lastSyncTime: Long
        get() = prefs.getLong(KEY_LAST_SYNC_TIME, 0L)
        set(value) = prefs.edit().putLong(KEY_LAST_SYNC_TIME, value).apply()

    var serverUserTheme: String
        get() = prefs.getString(KEY_SERVER_USER_THEME, "light") ?: "light"
        set(value) = prefs.edit().putString(KEY_SERVER_USER_THEME, value).apply()

    /**
     * Theme preference options: "user_profile" (default), "light", "dark", "system"
     */
    var themePreference: String
        get() = prefs.getString(KEY_THEME_PREFERENCE, THEME_USER_PROFILE) ?: THEME_USER_PROFILE
        set(value) = prefs.edit().putString(KEY_THEME_PREFERENCE, value).apply()

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

    fun toggleDarkMode() {
        val currentlyDark = isDarkMode()
        themePreference = if (currentlyDark) THEME_LIGHT else THEME_DARK
    }

    fun saveCachedWorklist(response: TodayWorklistResponse) {
        val encoded = json.encodeToString(response)
        serverUserTheme = response.userTheme
        prefs.edit()
            .putString(KEY_CACHED_WORKLIST, encoded)
            .putString(KEY_SERVER_USER_THEME, response.userTheme)
            .putLong(KEY_LAST_SYNC_TIME, System.currentTimeMillis())
            .apply()
    }

    fun getCachedWorklist(): TodayWorklistResponse? {
        val encoded = prefs.getString(KEY_CACHED_WORKLIST, null) ?: return null
        return try {
            json.decodeFromString<TodayWorklistResponse>(encoded)
        } catch (e: Exception) {
            null
        }
    }

    fun clearAuth() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USERNAME)
            .remove(KEY_CACHED_WORKLIST)
            .remove(KEY_LAST_SYNC_TIME)
            .remove(KEY_SERVER_USER_THEME)
            .apply()
    }

    companion object {
        private const val PREFS_FILENAME = "irlog_secure_widget_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USERNAME = "username"
        private const val KEY_CACHED_WORKLIST = "cached_worklist"
        private const val KEY_LAST_SYNC_TIME = "last_sync_time"
        private const val KEY_SERVER_USER_THEME = "server_user_theme"
        private const val KEY_THEME_PREFERENCE = "theme_preference"

        const val THEME_USER_PROFILE = "user_profile"
        const val THEME_LIGHT = "light"
        const val THEME_DARK = "dark"
        const val THEME_SYSTEM = "system"
    }
}
