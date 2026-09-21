import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';
import jwt from 'jsonwebtoken';
import { startOfMonth, subMonths, format, startOfYear, endOfYear, parseISO } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let user: any = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'irlog_widget_fallback_secret_key';
    try {
      user = jwt.verify(token, secret);
    } catch {
      try {
        user = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
      } catch {
        return res.status(401).json({ message: 'Invalid or expired widget token' });
      }
    }
  } else {
    user = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  }

  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  if (user.permissions) {
    const perms = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
    if (!perms?.viewOnly) return res.status(403).json({ message: 'Forbidden' });
  }

  const { type, dateFrom, dateTo, modality, monthOffset: monthOffsetParam, limit: limitParam } = req.query;

  try {
    if (type === 'monthly') {
      // Monthly trends: customizable window (default 12 months, widget can request e.g. 6 or 8)
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();
      const currentDay = now.getUTCDate();

      // monthOffset shifts the window backwards (0 = current, 1 = 1 month back, etc.)
      const offsetVal = parseInt(monthOffsetParam as string || '0', 10) || 0;
      const limitVal = Math.min(Math.max(parseInt(limitParam as string || '12', 10) || 12, 1), 24);

      const months = [];
      for (let i = limitVal - 1; i >= 0; i--) {
        // Calculate month offset from current month, adjusted by the navigation offset
        let year = currentYear;
        let month = currentMonth - i - offsetVal;
        while (month < 0) {
          month += 12;
          year -= 1;
        }

        // Start of this month (UTC)
        const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

        // End of this month (last day at 23:59:59.999 UTC)
        // For non-current months, use last day of month
        // For current month, use today
        let endYear = year;
        let endMonth = month;
        let endDay: number;

        if (i === 0 && offsetVal === 0) {
          // Current month with no offset - use today
          endDay = currentDay;
        } else {
          // Past months or offset applied - use last day of month
          endDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        }
        const end = new Date(Date.UTC(endYear, endMonth, endDay, 23, 59, 59, 999));

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.push({
          label: `${monthNames[month]} ${year}`,
          start,
          end
        });
      }

      const data = [];
      for (const m of months) {
        const where: any = {
          procedureDate: {
            gte: m.start,
            lte: m.end
          }
        };
        if (modality && modality !== 'All') {
          where.modality = modality;
        }
        const result = await prisma.procedureLog.aggregate({
          where,
          _count: { procedureID: true },
          _sum: { procedureCost: true },
        });
        data.push({
          label: m.label,
          count: result._count.procedureID,
          cost: result._sum.procedureCost || 0,
        });
      }
      return res.json({
        labels: data.map(d => d.label),
        series: [
          { name: 'Cases', data: data.map(d => d.count) },
          { name: 'Cost', data: data.map(d => d.cost) }
        ]
      });
    }
    if (type === 'daily') {
      // Daily trends: each day of a specific month, filtered by modality
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();
      const currentDay = now.getUTCDate();

      const dailyOffset = parseInt(monthOffsetParam as string || '0', 10) || 0;

      // Target month/year
      let targetMonth = currentMonth - dailyOffset;
      let targetYear = currentYear;
      while (targetMonth < 0) {
        targetMonth += 12;
        targetYear -= 1;
      }

      // Number of days in the target month
      const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      // For current month, data stops at today; future days get null
      const lastDataDay = (dailyOffset === 0) ? currentDay : daysInMonth;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const allModalities = ['USG', 'CT', 'OT', 'XF', 'DSA'];
      const modalityColors: Record<string, string> = {
        USG: 'rgba(59, 130, 246, 0.8)',   // blue
        CT: 'rgba(34, 197, 94, 0.8)',     // green
        OT: 'rgba(234, 179, 8, 0.8)',     // yellow
        XF: 'rgba(168, 85, 247, 0.8)',    // violet
        DSA: 'rgba(239, 68, 68, 0.8)',     // red
      };

      const targetModalities = (modality && modality !== 'All') ? [modality as string] : allModalities;

      const labels: string[] = [];
      // Initialize per-modality arrays
      const modalityCounts: Record<string, (number | null)[]> = {};
      for (const m of targetModalities) {
        modalityCounts[m] = [];
      }

      for (let day = 1; day <= daysInMonth; day++) {
        labels.push(day.toString());

        if (day <= lastDataDay) {
          const start = new Date(Date.UTC(targetYear, targetMonth, day, 0, 0, 0, 0));
          const end = new Date(Date.UTC(targetYear, targetMonth, day, 23, 59, 59, 999));

          for (const m of targetModalities) {
            const count = await prisma.procedureLog.count({
              where: {
                procedureDate: { gte: start, lte: end },
                modality: m,
              },
            });
            modalityCounts[m].push(count);
          }
        } else {
          for (const m of targetModalities) {
            modalityCounts[m].push(null);
          }
        }
      }

      const series = targetModalities.map(m => ({
        name: m,
        data: modalityCounts[m],
        color: modalityColors[m] || 'rgba(107, 114, 128, 0.8)',
      }));

      return res.json({
        labels,
        series,
        monthLabel: `${monthNames[targetMonth]} ${targetYear}`
      });
    }
    if (type === 'cumulative') {
      // Cricket Worm cumulative case counts for current month + last 12 months
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth(); // 0-indexed
      const currentDay = now.getUTCDate();

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Start of 12 months ago
      let startYear = currentYear;
      let startMonth = currentMonth - 12;
      while (startMonth < 0) {
        startMonth += 12;
        startYear -= 1;
      }
      const windowStartDate = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0));
      const windowEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

      const where: any = {
        procedureDate: {
          gte: windowStartDate,
          lte: windowEndDate,
        },
      };
      if (modality && modality !== 'All') {
        where.modality = modality;
      }

      // Single query for all procedures across the 13-month window
      const logs = await prisma.procedureLog.findMany({
        where,
        select: {
          procedureDate: true,
        },
      });

      // Group counts by "YYYY-MM" and day
      const counts: Record<string, Record<number, number>> = {};
      for (const log of logs) {
        const d = new Date(log.procedureDate);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        if (!counts[key]) counts[key] = {};
        counts[key][day] = (counts[key][day] || 0) + 1;
      }

      // Current month cumulative data
      const currentDaysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
      const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const currentData: (number | null)[] = [];
      let currentCum = 0;
      for (let day = 1; day <= 31; day++) {
        if (day <= currentDay) {
          currentCum += (counts[currentKey]?.[day] || 0);
          currentData.push(currentCum);
        } else {
          currentData.push(null);
        }
      }

      const currentMonthInfo = {
        key: currentKey,
        label: `${monthNames[currentMonth]} ${currentYear}`,
        total: currentCum,
        currentDay,
        daysInMonth: currentDaysInMonth,
        data: currentData,
      };

      // Past 12 months cumulative data
      const pastMonths = [];
      for (let offset = 1; offset <= 12; offset++) {
        let y = currentYear;
        let m = currentMonth - offset;
        while (m < 0) {
          m += 12;
          y -= 1;
        }
        const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${monthNames[m]} ${y}`;
        const data: (number | null)[] = [];
        let cum = 0;
        for (let day = 1; day <= 31; day++) {
          if (day <= daysInMonth) {
            cum += (counts[key]?.[day] || 0);
            data.push(cum);
          } else {
            data.push(null);
          }
        }
        const countAtCurrentDay = data[Math.min(currentDay, daysInMonth) - 1] ?? 0;
        pastMonths.push({
          key,
          label,
          offset,
          total: cum,
          countAtCurrentDay,
          daysInMonth,
          data,
        });
      }

      const labels = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

      return res.json({
        labels,
        currentMonth: currentMonthInfo,
        months: pastMonths,
      });
    }
    if (type === 'modality') {
      // Modality trends: x-axis modality, y-axis count, filtered by date
      const modalities = ['USG', 'CT', 'OT', 'XF', 'DSA'];
      let where: any = {};
      if (dateFrom) where.procedureDate = { ...(where.procedureDate || {}), gte: parseISO(dateFrom as string) };
      if (dateTo) where.procedureDate = { ...(where.procedureDate || {}), lte: parseISO(dateTo as string) };
      const data = [];
      for (const m of modalities) {
        const count = await prisma.procedureLog.count({ where: { ...where, modality: m } });
        data.push({ label: m, count });
      }
      return res.json({ labels: data.map(d => d.label), data: data.map(d => d.count) });
    }
    if (type === 'physician') {
      // By Referring Physician: y-axis physician, x-axis count, filtered by date
      let where: any = {};
      if (dateFrom) where.procedureDate = { ...(where.procedureDate || {}), gte: parseISO(dateFrom as string) };
      if (dateTo) where.procedureDate = { ...(where.procedureDate || {}), lte: parseISO(dateTo as string) };
      const logs = await prisma.procedureLog.findMany({ where, select: { refPhysicianObj: { select: { name: true } } } });
      const counts: Record<string, number> = {};
      for (const log of logs) {
        const name = log.refPhysicianObj?.name || 'Unknown';
        counts[name] = (counts[name] || 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return res.json({ labels: sorted.map(([k]) => k), data: sorted.map(([, v]) => v) });
    }
    if (type === 'yearly' || type === 'yearly-cumulative') {
      // Yearly cumulative trends: month-by-month cumulative case counts across years
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth(); // 0..11

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Find earliest recorded year
      const first = await prisma.procedureLog.findFirst({
        orderBy: { procedureDate: 'asc' },
        select: { procedureDate: true },
      });

      const earliestYear = first ? new Date(first.procedureDate).getUTCFullYear() : currentYear - 1;
      // Start year is at least 1 year prior to currentYear, or earliest recorded year
      const startYear = Math.min(earliestYear, currentYear - 1);

      const where: any = {
        procedureDate: {
          gte: new Date(Date.UTC(startYear, 0, 1, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)),
        },
      };
      if (modality && modality !== 'All') {
        where.modality = modality;
      }

      const logs = await prisma.procedureLog.findMany({
        where,
        select: { procedureDate: true },
      });

      // Group counts by year and month (0..11)
      const counts: Record<number, Record<number, number>> = {};
      for (const log of logs) {
        const d = new Date(log.procedureDate);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        if (!counts[y]) counts[y] = {};
        counts[y][m] = (counts[y][m] || 0) + 1;
      }

      // Build current year cumulative data
      const currentData: (number | null)[] = [];
      let currentCum = 0;
      for (let m = 0; m < 12; m++) {
        if (m <= currentMonth) {
          currentCum += (counts[currentYear]?.[m] || 0);
          currentData.push(currentCum);
        } else {
          currentData.push(null);
        }
      }

      const currentYearInfo = {
        year: currentYear,
        label: currentYear.toString(),
        total: currentCum,
        currentMonth,
        currentMonthName: monthNames[currentMonth],
        data: currentData,
      };

      // Build past years cumulative data (from currentYear - 1 down to startYear)
      const pastYears = [];
      for (let y = currentYear - 1; y >= startYear; y--) {
        const data: (number | null)[] = [];
        let cum = 0;
        for (let m = 0; m < 12; m++) {
          cum += (counts[y]?.[m] || 0);
          data.push(cum);
        }
        const countAtCurrentMonth = data[currentMonth] ?? 0;
        pastYears.push({
          year: y,
          label: y.toString(),
          total: cum,
          countAtCurrentMonth,
          data,
        });
      }

      return res.json({
        labels: monthNames,
        currentYear: currentYearInfo,
        years: pastYears,
      });
    }
    return res.status(400).json({ message: 'Invalid type' });
  } catch (e) {
    console.error('Analytics API error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 