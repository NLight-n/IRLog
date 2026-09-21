package com.irlog.widget.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.timepicker.MaterialTimePicker
import com.google.android.material.timepicker.TimeFormat
import com.irlog.widget.R
import com.irlog.widget.data.api.IRLogApiService
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.databinding.ActivityMainBinding
import com.irlog.widget.widget.IRLogMediumWidget
import com.irlog.widget.widget.IRLogSmallWidget
import com.irlog.widget.widget.IRLogWidget
import com.irlog.widget.worker.WidgetSyncWorker
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

open class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var storage: SecureTokenStorage
    private lateinit var apiService: IRLogApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        storage = SecureTokenStorage(this)
        apiService = IRLogApiService(storage)

        initViews()
        updateUiState()
        checkNotificationPermission()
    }

    override fun onResume() {
        super.onResume()
        updateUiState()
    }

    private fun initViews() {
        // Pre-fill configured or default server URL
        val defaultUrl = "https://claritymdt.snhrc.org/irlog"
        if (storage.serverUrl.isNotBlank()) {
            binding.etServerUrl.setText(storage.serverUrl)
        } else {
            binding.etServerUrl.setText(defaultUrl)
        }

        // Initialize Theme selection
        when (storage.themePreference) {
            SecureTokenStorage.THEME_LIGHT -> binding.rbThemeLight.isChecked = true
            SecureTokenStorage.THEME_DARK -> binding.rbThemeDark.isChecked = true
            SecureTokenStorage.THEME_SYSTEM -> binding.rbThemeSystem.isChecked = true
            else -> binding.rbThemeUserProfile.isChecked = true
        }

        binding.rgTheme.setOnCheckedChangeListener { _, checkedId ->
            storage.themePreference = when (checkedId) {
                R.id.rbThemeLight -> SecureTokenStorage.THEME_LIGHT
                R.id.rbThemeDark -> SecureTokenStorage.THEME_DARK
                R.id.rbThemeSystem -> SecureTokenStorage.THEME_SYSTEM
                else -> SecureTokenStorage.THEME_USER_PROFILE
            }
            lifecycleScope.launch {
                IRLogWidget().updateAll(applicationContext)
                IRLogSmallWidget().updateAll(applicationContext)
                IRLogMediumWidget().updateAll(applicationContext)
            }
        }

        // Initialize Work Hours UI & Pickers
        updateWorkHoursUi()

        binding.layoutStartTime.setOnClickListener {
            val picker = MaterialTimePicker.Builder()
                .setTimeFormat(TimeFormat.CLOCK_12H)
                .setHour(storage.workHoursStartHour)
                .setMinute(storage.workHoursStartMinute)
                .setTitleText("Select Work Start Time")
                .build()

            picker.addOnPositiveButtonClickListener {
                storage.workHoursStartHour = picker.hour
                storage.workHoursStartMinute = picker.minute
                updateWorkHoursUi()
                WidgetSyncWorker.scheduleNextSync(this)
                Toast.makeText(this, "Work start time updated", Toast.LENGTH_SHORT).show()
            }
            picker.show(supportFragmentManager, "start_time_picker")
        }

        binding.layoutEndTime.setOnClickListener {
            val picker = MaterialTimePicker.Builder()
                .setTimeFormat(TimeFormat.CLOCK_12H)
                .setHour(storage.workHoursEndHour)
                .setMinute(storage.workHoursEndMinute)
                .setTitleText("Select Work End Time")
                .build()

            picker.addOnPositiveButtonClickListener {
                storage.workHoursEndHour = picker.hour
                storage.workHoursEndMinute = picker.minute
                updateWorkHoursUi()
                WidgetSyncWorker.scheduleNextSync(this)
                Toast.makeText(this, "Work end time updated", Toast.LENGTH_SHORT).show()
            }
            picker.show(supportFragmentManager, "end_time_picker")
        }

        binding.btnPasskeyAuth.setOnClickListener {
            launchPasskeyAuth()
        }

        binding.btnTestSync.setOnClickListener {
            performSync()
        }

        binding.btnDisconnect.setOnClickListener {
            storage.clearAuth()
            updateUiState()
            lifecycleScope.launch {
                IRLogWidget().updateAll(applicationContext)
                IRLogSmallWidget().updateAll(applicationContext)
                IRLogMediumWidget().updateAll(applicationContext)
            }
            Toast.makeText(this, "Disconnected from IRLog", Toast.LENGTH_SHORT).show()
        }

        binding.btnOpenApp.setOnClickListener {
            val launchIntent = Intent(this, IRLogTwaLauncherActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(launchIntent)
            finish()
        }
    }

    private fun launchPasskeyAuth() {
        val rawUrl = binding.etServerUrl.text.toString().trim()
        if (rawUrl.isBlank()) {
            binding.tilServerUrl.error = "Please enter your IRLog server URL"
            return
        }

        val serverUrl = if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
            "https://$rawUrl"
        } else {
            rawUrl
        }.trimEnd('/')

        try {
            storage.serverUrl = serverUrl
        } catch (_: Exception) {}
        binding.tilServerUrl.error = null

        // Open Chrome Custom Tab to /widget-auth/
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
                Toast.makeText(this, "Could not open browser: ${ex.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
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

    private fun performSync() {
        if (!storage.isAuthenticated) {
            Toast.makeText(this, "Please authenticate first", Toast.LENGTH_SHORT).show()
            return
        }

        binding.btnTestSync.isEnabled = false
        binding.btnTestSync.text = "Syncing..."

        lifecycleScope.launch {
            val result = apiService.fetchTodayWorklist()
            binding.btnTestSync.isEnabled = true
            binding.btnTestSync.text = getString(R.string.btn_test_sync)

            result.onSuccess { response ->
                updateUiState()
                IRLogWidget().updateAll(applicationContext)
                IRLogSmallWidget().updateAll(applicationContext)
                IRLogMediumWidget().updateAll(applicationContext)
                Snackbar.make(
                    binding.root,
                    "Sync successful: ${response.items.size} cases found for today",
                    Snackbar.LENGTH_SHORT
                ).show()
            }.onFailure { error ->
                Snackbar.make(
                    binding.root,
                    "Sync failed: ${error.localizedMessage ?: "Unknown error"}",
                    Snackbar.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun updateUiState() {
        val isAuth = storage.isAuthenticated
        val username = storage.username ?: "User"

        if (isAuth) {
            binding.tvStatus.text = getString(R.string.status_connected, username)
            binding.tvStatus.setTextColor(getColor(R.color.status_done))
            binding.btnPasskeyAuth.text = "Re-authenticate with Passkey"
            binding.btnDisconnect.isEnabled = true
            binding.btnTestSync.isEnabled = true
            binding.btnOpenApp.visibility = View.VISIBLE
        } else {
            binding.tvStatus.text = getString(R.string.status_disconnected)
            binding.tvStatus.setTextColor(getColor(R.color.widget_text_secondary))
            binding.btnPasskeyAuth.text = getString(R.string.btn_passkey_auth)
            binding.btnDisconnect.isEnabled = false
            binding.btnTestSync.isEnabled = false
            binding.btnOpenApp.visibility = View.GONE
        }

        val lastSync = storage.lastSyncTime
        if (lastSync > 0) {
            val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
            binding.tvLastSync.text = getString(R.string.status_last_sync, sdf.format(Date(lastSync)))
        } else {
            binding.tvLastSync.text = "Last synced: Never"
        }
    }

    private fun updateWorkHoursUi() {
        binding.tvWorkStartTime.text = formatTime(storage.workHoursStartHour, storage.workHoursStartMinute)
        binding.tvWorkEndTime.text = formatTime(storage.workHoursEndHour, storage.workHoursEndMinute)
    }

    private fun formatTime(hour: Int, minute: Int): String {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
        }
        return SimpleDateFormat("hh:mm a", Locale.getDefault()).format(cal.time)
    }

    private fun checkNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (androidx.core.content.ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) != android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                androidx.core.app.ActivityCompat.requestPermissions(
                    this,
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        }
    }
}
