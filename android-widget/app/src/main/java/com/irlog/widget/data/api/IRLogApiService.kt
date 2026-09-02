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

    suspend fun fetchTodayWorklist(): Result<TodayWorklistResponse> = withContext(Dispatchers.IO) {
        val serverUrl = storage.serverUrl
        val token = storage.authToken

        if (serverUrl.isBlank()) {
            return@withContext Result.failure(IllegalStateException("Server URL is not configured."))
        }
        if (token.isNullOrBlank()) {
            return@withContext Result.failure(IllegalStateException("Not authenticated. Please sign in."))
        }

        try {
            val formattedUrl = if (serverUrl.endsWith("/")) serverUrl else "$serverUrl/"
            val contentType = "application/json".toMediaType()

            val retrofit = Retrofit.Builder()
                .baseUrl(formattedUrl)
                .client(okHttpClient)
                .addConverterFactory(json.asConverterFactory(contentType))
                .build()

            val api = retrofit.create(IRLogApi::class.java)
            
            // Calculate device timezone offset in minutes
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
}
