package com.irlog.widget.worker

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.irlog.widget.data.api.IRLogApiService
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.widget.IRLogMediumWidget
import com.irlog.widget.widget.IRLogSmallWidget
import com.irlog.widget.widget.IRLogWidget
import com.irlog.widget.widget.MonthlyCumulativeWidget
import com.irlog.widget.widget.MonthlyTrendsWidget
import com.irlog.widget.widget.YearlyCumulativeWidget
import java.util.Calendar
import java.util.concurrent.TimeUnit

class WidgetSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val storage = SecureTokenStorage(context)
        try {
            if (storage.isAuthenticated) {
                val apiService = IRLogApiService(storage)
                val fetchResult = apiService.fetchTodayWorklist()
                if (fetchResult.isSuccess) {
                    // Update all active glance worklist widgets
                    IRLogWidget().updateAll(context)
                    IRLogSmallWidget().updateAll(context)
                    IRLogMediumWidget().updateAll(context)
                }

                // Daily automatic refresh for analytics widgets (every 24 hours)
                if (storage.shouldSyncAnalyticsDaily()) {
                    val analyticsResult = apiService.syncAllAnalytics()
                    if (analyticsResult) {
                        MonthlyTrendsWidget().updateAll(context)
                        MonthlyCumulativeWidget().updateAll(context)
                        YearlyCumulativeWidget().updateAll(context)
                    }
                }
            }
        } catch (_: Exception) {
            // Silently handle error, fallback to cache
        } finally {
            // Dynamically schedule next sync (15m during work hours, 60m off-hours/night)
            scheduleNextSync(context)
        }
        return Result.success()
    }

    companion object {
        const val WORK_NAME = "irlog_widget_sync_work"
        const val INTERVAL_WORK_HOURS_MIN = 15L
        const val INTERVAL_OFF_HOURS_MIN = 60L

        fun calculateNextSyncDelayMinutes(context: Context): Long {
            val storage = SecureTokenStorage(context)
            val calendar = Calendar.getInstance()
            val currentHour = calendar.get(Calendar.HOUR_OF_DAY)
            val currentMinute = calendar.get(Calendar.MINUTE)
            val currentTotalMinutes = currentHour * 60 + currentMinute

            val startTotalMinutes = storage.workHoursStartHour * 60 + storage.workHoursStartMinute
            val endTotalMinutes = storage.workHoursEndHour * 60 + storage.workHoursEndMinute

            val isWorkHours = if (startTotalMinutes <= endTotalMinutes) {
                currentTotalMinutes in startTotalMinutes until endTotalMinutes
            } else {
                // Overnight shift (e.g. 20:00 to 08:00)
                currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes
            }

            return if (isWorkHours) {
                // During configured work hours: 15 minutes
                INTERVAL_WORK_HOURS_MIN
            } else {
                // After hours / night: 60 minutes or remaining time until work starts
                val minutesUntilWork = if (currentTotalMinutes < startTotalMinutes) {
                    startTotalMinutes - currentTotalMinutes
                } else {
                    (24 * 60 - currentTotalMinutes) + startTotalMinutes
                }
                minOf(INTERVAL_OFF_HOURS_MIN, maxOf(INTERVAL_WORK_HOURS_MIN, minutesUntilWork.toLong()))
            }
        }

        fun scheduleNextSync(context: Context, isInitial: Boolean = false) {
            val delayMinutes = if (isInitial) 0L else calculateNextSyncDelayMinutes(context)

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true) // Conserves battery when device is below 15-20%
                .build()

            val syncRequest = OneTimeWorkRequestBuilder<WidgetSyncWorker>()
                .setInitialDelay(delayMinutes, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                if (isInitial) ExistingWorkPolicy.KEEP else ExistingWorkPolicy.REPLACE,
                syncRequest
            )
        }
    }
}
