package com.irlog.widget.data.model

import kotlinx.serialization.Serializable

@Serializable
data class WorkItemDto(
    val id: Int,
    val patientID: String = "",
    val patientName: String = "Unnamed Patient",
    val patientAge: Int? = null,
    val patientSex: String? = null,
    val procedureName: String = "Procedure",
    val modality: String = "IR",
    val appointmentTime: String? = null,
    val status: String = "Scheduled",
    val stage: String = "Scheduled",
    val notes: String? = null,
    val displayOrder: Int = 0
)

@Serializable
data class TodayWorklistSummary(
    val total: Int = 0,
    val scheduled: Int = 0,
    val done: Int = 0,
    val notDone: Int = 0,
    val cancelled: Int = 0
)

@Serializable
data class TodayWorklistResponse(
    val date: String,
    val serverTime: String = "",
    val userTheme: String = "light",
    val summary: TodayWorklistSummary = TodayWorklistSummary(),
    val items: List<WorkItemDto> = emptyList()
)

@Serializable
data class WidgetCachedData(
    val lastSyncTimestamp: Long = 0L,
    val response: TodayWorklistResponse? = null,
    val errorMessage: String? = null
)
