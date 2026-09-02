package com.irlog.widget.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import com.irlog.widget.data.api.IRLogApiService
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.widget.IRLogWidget
import kotlinx.coroutines.launch

class AuthCallbackActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val uri = intent?.data
        if (uri != null && uri.scheme == "irlog" && uri.host == "auth-callback") {
            val token = uri.getQueryParameter("token")
            val username = uri.getQueryParameter("username")

            if (!token.isNullOrBlank()) {
                val storage = SecureTokenStorage(this)
                storage.authToken = token
                if (!username.isNullOrBlank()) {
                    storage.username = username
                }

                // Trigger initial sync and update widgets immediately
                val apiService = IRLogApiService(storage)
                lifecycleScope.launch {
                    apiService.fetchTodayWorklist()
                    IRLogWidget().updateAll(applicationContext)
                }

                Toast.makeText(this, "Passkey authentication successful! Widget connected.", Toast.LENGTH_LONG).show()
            } else {
                Toast.makeText(this, "Authentication failed: Missing token.", Toast.LENGTH_SHORT).show()
            }
        }

        // Return to MainActivity
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(mainIntent)
        finish()
    }
}
