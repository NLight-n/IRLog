package com.irlog.widget.widget.chart

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import kotlin.math.ceil
import kotlin.math.max

object ChartBitmapRenderer {

    private const val DEFAULT_WIDTH = 720
    private const val DEFAULT_HEIGHT = 260

    // Curated palette matching IRLog web design
    private val COLOR_BLUE = Color.parseColor("#2563EB")
    private val COLOR_GREEN = Color.parseColor("#10B981")
    private val COLOR_AMBER = Color.parseColor("#F59E0B")
    private val COLOR_RED = Color.parseColor("#EF4444")

    /**
     * Renders a 4x2 Dual-Axis Monthly Trends Chart (Cases vs Cost) for the last 6 months.
     */
    fun renderMonthlyTrendsChart(
        labels: List<String>,
        casesData: List<Double?>,
        costData: List<Double?>,
        isDark: Boolean,
        width: Int = DEFAULT_WIDTH,
        height: Int = DEFAULT_HEIGHT
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val gridColor = if (isDark) Color.parseColor("#27272A") else Color.parseColor("#E5E7EB")
        val textMuted = if (isDark) Color.parseColor("#71717A") else Color.parseColor("#9CA3AF")

        // Padding
        val padLeft = 65f
        val padRight = 75f
        val padTop = 25f
        val padBottom = 45f

        val chartWidth = width - padLeft - padRight
        val chartHeight = height - padTop - padBottom

        // Compute max for cases and cost
        val maxCasesRaw = casesData.filterNotNull().maxOrNull() ?: 1.0
        val maxCostRaw = costData.filterNotNull().maxOrNull() ?: 1.0

        // Synchronize 5 intervals (6 horizontal lines: 0%, 25%, 50%, 75%, 100%)
        val intervals = 5
        val stepCases = max(1.0, ceil(maxCasesRaw / intervals))
        val maxCases = stepCases * intervals

        val stepCost = max(100.0, ceil(maxCostRaw / intervals / 500.0) * 500.0)
        val maxCost = stepCost * intervals

        // Grid Paint
        val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = gridColor
            strokeWidth = 1.5f
            style = Paint.Style.STROKE
        }

        // Text Paints
        val textPaintCases = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_BLUE
            textSize = 20f
            textAlign = Paint.Align.RIGHT
        }

        val textPaintCost = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_RED
            textSize = 20f
            textAlign = Paint.Align.LEFT
        }

        val textPaintX = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMuted
            textSize = 21f
            textAlign = Paint.Align.CENTER
        }

        // Draw horizontal grid lines & Y-axis labels
        for (i in 0..intervals) {
            val y = padTop + chartHeight - (i.toFloat() / intervals * chartHeight)
            canvas.drawLine(padLeft, y, padLeft + chartWidth, y, gridPaint)

            // Left tick (Cases)
            val caseVal = (i * stepCases).toInt()
            canvas.drawText("$caseVal", padLeft - 10f, y + 7f, textPaintCases)

            // Right tick (Cost in $ or $k)
            val costVal = (i * stepCost).toInt()
            val costStr = if (costVal >= 1000) "$${costVal / 1000}k" else "$$costVal"
            canvas.drawText(costStr, padLeft + chartWidth + 10f, y + 7f, textPaintCost)
        }

        val pointCount = labels.size
        if (pointCount < 2) return bitmap

        val stepX = chartWidth / (pointCount - 1)

        // Draw X-axis labels
        for (i in 0 until pointCount) {
            val x = padLeft + i * stepX
            val rawLabel = labels[i]
            // Format label e.g. "Apr 2026" -> "Apr"
            val shortLabel = rawLabel.split(" ").firstOrNull() ?: rawLabel
            canvas.drawText(shortLabel, x, height - 12f, textPaintX)
        }

        // Helper to draw smooth path
        fun drawLine(data: List<Double?>, maxVal: Double, lineColor: Int, isCost: Boolean) {
            val path = Path()
            val points = mutableListOf<Pair<Float, Float>>()

            for (i in 0 until minOf(pointCount, data.size)) {
                val v = data[i] ?: continue
                val x = padLeft + i * stepX
                val y = padTop + chartHeight - ((v / maxVal).toFloat() * chartHeight)
                points.add(Pair(x, y))
            }

            if (points.isEmpty()) return

            val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = lineColor
                strokeWidth = 4f
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }

            path.moveTo(points[0].first, points[0].second)
            for (i in 1 until points.size) {
                val p0 = points[i - 1]
                val p1 = points[i]
                val midX = (p0.first + p1.first) / 2
                path.cubicTo(midX, p0.second, midX, p1.second, p1.first, p1.second)
            }
            canvas.drawPath(path, strokePaint)

            // Points
            if (isCost) {
                // Draw small dollar symbol badge
                val badgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = lineColor
                    style = Paint.Style.FILL
                }
                val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.WHITE
                    strokeWidth = 2f
                    style = Paint.Style.STROKE
                }
                val dollarTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.WHITE
                    textSize = 15f
                    textAlign = Paint.Align.CENTER
                    isFakeBoldText = true
                }

                for (pt in points) {
                    canvas.drawCircle(pt.first, pt.second, 12f, badgePaint)
                    canvas.drawCircle(pt.first, pt.second, 12f, borderPaint)
                    canvas.drawText("$", pt.first, pt.second + 5.5f, dollarTextPaint)
                }
            } else {
                // Draw circular dots
                val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = lineColor
                    style = Paint.Style.FILL
                }
                val dotBorder = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = if (isDark) Color.parseColor("#18181B") else Color.WHITE
                    strokeWidth = 3f
                    style = Paint.Style.STROKE
                }
                for (pt in points) {
                    canvas.drawCircle(pt.first, pt.second, 7f, dotPaint)
                    canvas.drawCircle(pt.first, pt.second, 7f, dotBorder)
                }
            }
        }

        // Draw Cost line first, then Cases line on top
        drawLine(costData, maxCost, COLOR_RED, isCost = true)
        drawLine(casesData, maxCases, COLOR_BLUE, isCost = false)

        return bitmap
    }

    /**
     * Renders a 4x2 Cumulative Monthly Worm Chart comparing 3 curves:
     * - Current Month (Blue, up to today)
     * - Previous Month (Green, full month)
     * - 2 Months Ago (Amber, full month)
     */
    fun renderMonthlyCumulativeChart(
        currentMonthData: List<Int?>,
        previousMonthData: List<Int?>,
        twoMonthsAgoData: List<Int?>,
        currentDay: Int,
        isDark: Boolean,
        width: Int = DEFAULT_WIDTH,
        height: Int = DEFAULT_HEIGHT
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val gridColor = if (isDark) Color.parseColor("#27272A") else Color.parseColor("#E5E7EB")
        val textMuted = if (isDark) Color.parseColor("#71717A") else Color.parseColor("#9CA3AF")

        val padLeft = 55f
        val padRight = 30f
        val padTop = 25f
        val padBottom = 45f

        val chartWidth = width - padLeft - padRight
        val chartHeight = height - padTop - padBottom

        // Compute max cases
        val allVals = mutableListOf<Int>()
        allVals.addAll(currentMonthData.filterNotNull())
        allVals.addAll(previousMonthData.filterNotNull())
        allVals.addAll(twoMonthsAgoData.filterNotNull())
        val maxValRaw = (allVals.maxOrNull() ?: 10).coerceAtLeast(10)

        val intervals = 5
        val step = ceil(maxValRaw.toDouble() / intervals).toInt().coerceAtLeast(1)
        val maxVal = step * intervals

        // Grid & Ticks
        val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = gridColor
            strokeWidth = 1.5f
            style = Paint.Style.STROKE
        }
        val textPaintY = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMuted
            textSize = 20f
            textAlign = Paint.Align.RIGHT
        }
        val textPaintX = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMuted
            textSize = 20f
            textAlign = Paint.Align.CENTER
        }

        for (i in 0..intervals) {
            val y = padTop + chartHeight - (i.toFloat() / intervals * chartHeight)
            canvas.drawLine(padLeft, y, padLeft + chartWidth, y, gridPaint)
            canvas.drawText("${i * step}", padLeft - 10f, y + 7f, textPaintY)
        }

        // Draw subtle vertical dashed line for today
        if (currentDay in 1..31) {
            val xToday = padLeft + ((currentDay - 1).toFloat() / 30f) * chartWidth
            val todayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (isDark) Color.parseColor("#3B82F6") else Color.parseColor("#60A5FA")
                strokeWidth = 1.8f
                style = Paint.Style.STROKE
                pathEffect = DashPathEffect(floatArrayOf(6f, 6f), 0f)
                alpha = 120
            }
            canvas.drawLine(xToday, padTop, xToday, padTop + chartHeight, todayPaint)
        }

        // X-axis: 31 days
        val totalDays = 31
        val stepX = chartWidth / (totalDays - 1)
        val dayMarkers = listOf(1, 5, 10, 15, 20, 25, 30)
        for (day in dayMarkers) {
            val x = padLeft + (day - 1) * stepX
            canvas.drawText("D$day", x, height - 12f, textPaintX)
        }

        // Helper to draw curve
        fun drawCurve(data: List<Int?>, lineColor: Int, strokeWidthPx: Float, isCurrent: Boolean) {
            val points = mutableListOf<Pair<Float, Float>>()
            for (d in 0 until minOf(totalDays, data.size)) {
                val v = data[d] ?: continue
                val x = padLeft + d * stepX
                val y = padTop + chartHeight - ((v.toFloat() / maxVal) * chartHeight)
                points.add(Pair(x, y))
            }
            if (points.isEmpty()) return

            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = lineColor
                strokeWidth = strokeWidthPx
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }

            val path = Path()
            path.moveTo(points[0].first, points[0].second)
            for (i in 1 until points.size) {
                val p0 = points[i - 1]
                val p1 = points[i]
                val midX = (p0.first + p1.first) / 2
                path.cubicTo(midX, p0.second, midX, p1.second, p1.first, p1.second)
            }
            canvas.drawPath(path, paint)

            // If current month, draw prominent highlight dot at the endpoint
            if (isCurrent && points.isNotEmpty()) {
                val endPt = points.last()
                val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = lineColor
                    style = Paint.Style.FILL
                }
                val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.WHITE
                    strokeWidth = 3f
                    style = Paint.Style.STROKE
                }
                canvas.drawCircle(endPt.first, endPt.second, 9f, dotPaint)
                canvas.drawCircle(endPt.first, endPt.second, 9f, borderPaint)
            }
        }

        // Draw 2 months ago (amber), previous month (green), current month (blue)
        drawCurve(twoMonthsAgoData, COLOR_AMBER, 3.5f, isCurrent = false)
        drawCurve(previousMonthData, COLOR_GREEN, 3.5f, isCurrent = false)
        drawCurve(currentMonthData, COLOR_BLUE, 5.5f, isCurrent = true)

        return bitmap
    }

    /**
     * Renders a 4x2 Cumulative Yearly Worm Chart comparing 3 curves:
     * - Current Year (Blue, up to current month)
     * - Previous Year (Green, full 12 months)
     * - 2 Years Ago (Amber, full 12 months)
     */
    fun renderYearlyCumulativeChart(
        currentYearData: List<Int?>,
        previousYearData: List<Int?>,
        twoYearsAgoData: List<Int?>,
        currentMonthIndex: Int,
        isDark: Boolean,
        width: Int = DEFAULT_WIDTH,
        height: Int = DEFAULT_HEIGHT
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val gridColor = if (isDark) Color.parseColor("#27272A") else Color.parseColor("#E5E7EB")
        val textMuted = if (isDark) Color.parseColor("#71717A") else Color.parseColor("#9CA3AF")

        val padLeft = 60f
        val padRight = 30f
        val padTop = 25f
        val padBottom = 45f

        val chartWidth = width - padLeft - padRight
        val chartHeight = height - padTop - padBottom

        val allVals = mutableListOf<Int>()
        allVals.addAll(currentYearData.filterNotNull())
        allVals.addAll(previousYearData.filterNotNull())
        allVals.addAll(twoYearsAgoData.filterNotNull())
        val maxValRaw = (allVals.maxOrNull() ?: 50).coerceAtLeast(50)

        val intervals = 5
        val step = (ceil(maxValRaw.toDouble() / intervals / 10.0) * 10).toInt().coerceAtLeast(10)
        val maxVal = step * intervals

        val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = gridColor
            strokeWidth = 1.5f
            style = Paint.Style.STROKE
        }
        val textPaintY = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMuted
            textSize = 20f
            textAlign = Paint.Align.RIGHT
        }
        val textPaintX = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textMuted
            textSize = 20f
            textAlign = Paint.Align.CENTER
        }

        for (i in 0..intervals) {
            val y = padTop + chartHeight - (i.toFloat() / intervals * chartHeight)
            canvas.drawLine(padLeft, y, padLeft + chartWidth, y, gridPaint)
            canvas.drawText("${i * step}", padLeft - 10f, y + 7f, textPaintY)
        }

        // Draw subtle vertical dashed line for current month
        if (currentMonthIndex in 0..11) {
            val xMonth = padLeft + (currentMonthIndex.toFloat() / 11f) * chartWidth
            val monthPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (isDark) Color.parseColor("#3B82F6") else Color.parseColor("#60A5FA")
                strokeWidth = 1.8f
                style = Paint.Style.STROKE
                pathEffect = DashPathEffect(floatArrayOf(6f, 6f), 0f)
                alpha = 120
            }
            canvas.drawLine(xMonth, padTop, xMonth, padTop + chartHeight, monthPaint)
        }

        // X-axis: 12 months
        val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        val stepX = chartWidth / (months.size - 1)
        for (m in 0 until months.size) {
            // Draw every other month or short letters to avoid crowding
            if (m % 2 == 0 || m == months.size - 1) {
                val x = padLeft + m * stepX
                canvas.drawText(months[m], x, height - 12f, textPaintX)
            }
        }

        fun drawCurve(data: List<Int?>, lineColor: Int, strokeWidthPx: Float, isCurrent: Boolean) {
            val points = mutableListOf<Pair<Float, Float>>()
            for (m in 0 until minOf(12, data.size)) {
                val v = data[m] ?: continue
                val x = padLeft + m * stepX
                val y = padTop + chartHeight - ((v.toFloat() / maxVal) * chartHeight)
                points.add(Pair(x, y))
            }
            if (points.isEmpty()) return

            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = lineColor
                strokeWidth = strokeWidthPx
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }

            val path = Path()
            path.moveTo(points[0].first, points[0].second)
            for (i in 1 until points.size) {
                val p0 = points[i - 1]
                val p1 = points[i]
                val midX = (p0.first + p1.first) / 2
                path.cubicTo(midX, p0.second, midX, p1.second, p1.first, p1.second)
            }
            canvas.drawPath(path, paint)

            if (isCurrent && points.isNotEmpty()) {
                val endPt = points.last()
                val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = lineColor
                    style = Paint.Style.FILL
                }
                val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.WHITE
                    strokeWidth = 3f
                    style = Paint.Style.STROKE
                }
                canvas.drawCircle(endPt.first, endPt.second, 9f, dotPaint)
                canvas.drawCircle(endPt.first, endPt.second, 9f, borderPaint)
            }
        }

        drawCurve(twoYearsAgoData, COLOR_AMBER, 3.5f, isCurrent = false)
        drawCurve(previousYearData, COLOR_GREEN, 3.5f, isCurrent = false)
        drawCurve(currentYearData, COLOR_BLUE, 5.5f, isCurrent = true)

        return bitmap
    }

    /**
     * Renders a clean placeholder bitmap when no data is cached yet.
     */
    fun renderPlaceholderChart(message: String, isDark: Boolean, width: Int = DEFAULT_WIDTH, height: Int = DEFAULT_HEIGHT): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (isDark) Color.parseColor("#71717A") else Color.parseColor("#9CA3AF")
            textSize = 24f
            textAlign = Paint.Align.CENTER
        }

        canvas.drawText(message, width / 2f, height / 2f + 8f, paint)
        return bitmap
    }
}
