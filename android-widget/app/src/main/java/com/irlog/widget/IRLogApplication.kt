package com.irlog.widget

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.irlog.widget.worker.WidgetSyncWorker
import java.util.concurrent.TimeUnit

class IRLogApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        setupPeriodicWidgetSync()
    }

    private fun setupPeriodicWidgetSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        // Periodic sync every 15 minutes
        val syncRequest = PeriodicWorkRequestBuilder<WidgetSyncWorker>(
            15, TimeUnit.MINUTES,
            5, TimeUnit.MINUTES // Flex interval
        )
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            WidgetSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}
