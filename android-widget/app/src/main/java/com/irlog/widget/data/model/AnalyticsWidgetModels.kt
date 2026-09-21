package com.irlog.widget.data.model

import kotlinx.serialization.Serializable

@Serializable
data class MonthlySeries(
    val name: String,
    val data: List<Double?>
)

@Serializable
data class MonthlyTrendsResponse(
    val labels: List<String>,
    val series: List<MonthlySeries> = emptyList()
)

@Serializable
data class CumulativeMonthItem(
    val key: String,
    val label: String,
    val total: Int = 0,
    val currentDay: Int? = null,
    val countAtCurrentDay: Int? = null,
    val daysInMonth: Int = 31,
    val offset: Int? = null,
    val data: List<Int?> = emptyList()
)

@Serializable
data class CumulativeMonthlyResponse(
    val labels: List<String> = emptyList(),
    val currentMonth: CumulativeMonthItem,
    val months: List<CumulativeMonthItem> = emptyList()
)

@Serializable
data class CumulativeYearItem(
    val year: Int,
    val label: String,
    val total: Int = 0,
    val currentMonth: Int? = null,
    val currentMonthName: String? = null,
    val countAtCurrentMonth: Int? = null,
    val data: List<Int?> = emptyList()
)

@Serializable
data class CumulativeYearlyResponse(
    val labels: List<String> = emptyList(),
    val currentYear: CumulativeYearItem,
    val years: List<CumulativeYearItem> = emptyList()
)
