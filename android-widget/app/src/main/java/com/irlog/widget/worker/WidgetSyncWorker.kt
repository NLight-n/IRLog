package com.irlog.widget.worker

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.irlog.widget.data.api.IRLogApiService
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.widget.IRLogWidget

class WidgetSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val storage = SecureTokenStorage(context)
        if (!storage.isAuthenticated) {
            return Result.success()
        }

        val apiService = IRLogApiService(storage)
        return try {
            val fetchResult = apiService.fetchTodayWorklist()
            if (fetchResult.isSuccess) {
                // Update all active glance widgets
                IRLogWidget().updateAll(context)
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val WORK_NAME = "irlog_widget_sync_work"
    }
}
