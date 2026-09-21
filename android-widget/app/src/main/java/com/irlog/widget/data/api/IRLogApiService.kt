package com.irlog.widget.data.api

import com.irlog.widget.data.model.TodayWorklistResponse
import com.irlog.widget.data.storage.SecureTokenStorage
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query
import java.util.TimeZone
import java.util.concurrent.TimeUnit

interface IRLogApi {
    @GET("api/widget/today")
    suspend fun getTodayWorklist(
        @Header("Authorization") authHeader: String,
        @Query("tzOffset") tzOffsetMinutes: Int? = null
    ): TodayWorklistResponse

    @GET("api/procedures/analytics")
    suspend fun getMonthlyTrends(
        @Header("Authorization") authHeader: String,
        @Query("type") type: String = "monthly",
        @Query("limit") limit: Int = 6
    ): com.irlog.widget.data.model.MonthlyTrendsResponse

    @GET("api/procedures/analytics")
    suspend fun getCumulativeMonthly(
        @Header("Authorization") authHeader: String,
        @Query("type") type: String = "cumulative"
    ): com.irlog.widget.data.model.CumulativeMonthlyResponse

    @GET("api/procedures/analytics")
    suspend fun getCumulativeYearly(
        @Header("Authorization") authHeader: String,
        @Query("type") type: String = "yearly"
    ): com.irlog.widget.data.model.CumulativeYearlyResponse
}

class IRLogApiService(private val storage: SecureTokenStorage) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .addInterceptor(loggingInterceptor)
        .build()

    private fun createApi(): IRLogApi? {
        val serverUrl = storage.serverUrl
        if (serverUrl.isBlank()) return null
        val formattedUrl = if (serverUrl.endsWith("/")) serverUrl else "$serverUrl/"
        val contentType = "application/json".toMediaType()

        val retrofit = Retrofit.Builder()
            .baseUrl(formattedUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()

        return retrofit.create(IRLogApi::class.java)
    }

    suspend fun fetchTodayWorklist(): Result<TodayWorklistResponse> = withContext(Dispatchers.IO) {
        val token = storage.authToken
        if (token.isNullOrBlank()) {
            return@withContext Result.failure(IllegalStateException("Not authenticated. Please sign in."))
        }

        val api = createApi()
            ?: return@withContext Result.failure(IllegalStateException("Server URL is not configured."))

        try {
            val tz = TimeZone.getDefault()
            val offsetMinutes = -(tz.getOffset(System.currentTimeMillis()) / (1000 * 60))

            val response = api.getTodayWorklist(
                authHeader = "Bearer $token",
                tzOffsetMinutes = offsetMinutes
            )

            // Save to cache
            storage.saveCachedWorklist(response)

            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchMonthlyTrends(limit: Int = 6): Result<com.irlog.widget.data.model.MonthlyTrendsResponse> = withContext(Dispatchers.IO) {
        val token = storage.authToken
        if (token.isNullOrBlank()) return@withContext Result.failure(IllegalStateException("Not authenticated"))
        val api = createApi() ?: return@withContext Result.failure(IllegalStateException("No server configured"))

        try {
            val response = api.getMonthlyTrends(authHeader = "Bearer $token", limit = limit)
            storage.saveCachedMonthlyTrends(response)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchCumulativeMonthly(): Result<com.irlog.widget.data.model.CumulativeMonthlyResponse> = withContext(Dispatchers.IO) {
        val token = storage.authToken
        if (token.isNullOrBlank()) return@withContext Result.failure(IllegalStateException("Not authenticated"))
        val api = createApi() ?: return@withContext Result.failure(IllegalStateException("No server configured"))

        try {
            val response = api.getCumulativeMonthly(authHeader = "Bearer $token")
            storage.saveCachedCumulativeMonthly(response)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchCumulativeYearly(): Result<com.irlog.widget.data.model.CumulativeYearlyResponse> = withContext(Dispatchers.IO) {
        val token = storage.authToken
        if (token.isNullOrBlank()) return@withContext Result.failure(IllegalStateException("Not authenticated"))
        val api = createApi() ?: return@withContext Result.failure(IllegalStateException("No server configured"))

        try {
            val response = api.getCumulativeYearly(authHeader = "Bearer $token")
            storage.saveCachedCumulativeYearly(response)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncAllAnalytics(): Boolean = withContext(Dispatchers.IO) {
        if (!storage.isAuthenticated) return@withContext false
        try {
            fetchMonthlyTrends(6)
            fetchCumulativeMonthly()
            fetchCumulativeYearly()
            storage.lastAnalyticsSyncTime = System.currentTimeMillis()
            true
        } catch (_: Exception) {
            false
        }
    }
}
