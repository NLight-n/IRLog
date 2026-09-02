package com.irlog.widget.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import com.google.android.material.snackbar.Snackbar
import com.irlog.widget.R
import com.irlog.widget.data.api.IRLogApiService
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.databinding.ActivityMainBinding
import com.irlog.widget.widget.IRLogWidget
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

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
    }

    override fun onResume() {
        super.onResume()
        updateUiState()
    }

    private fun initViews() {
        if (storage.serverUrl.isNotBlank()) {
            binding.etServerUrl.setText(storage.serverUrl)
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
            }
            Toast.makeText(this, "Disconnected from IRLog", Toast.LENGTH_SHORT).show()
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

        storage.serverUrl = serverUrl
        binding.tilServerUrl.error = null

        // Open Chrome Custom Tab to /widget-auth/
        val authUri = Uri.parse("$serverUrl/widget-auth/")
        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabsIntent.launchUrl(this, authUri)
        } catch (e: Exception) {
            // Fallback to standard browser intent
            val browserIntent = Intent(Intent.ACTION_VIEW, authUri)
            startActivity(browserIntent)
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
        } else {
            binding.tvStatus.text = getString(R.string.status_disconnected)
            binding.tvStatus.setTextColor(getColor(R.color.widget_text_secondary))
            binding.btnPasskeyAuth.text = getString(R.string.btn_passkey_auth)
            binding.btnDisconnect.isEnabled = false
            binding.btnTestSync.isEnabled = false
        }

        val lastSync = storage.lastSyncTime
        if (lastSync > 0) {
            val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
            binding.tvLastSync.text = getString(R.string.status_last_sync, sdf.format(Date(lastSync)))
        } else {
            binding.tvLastSync.text = "Last synced: Never"
        }
    }
}
