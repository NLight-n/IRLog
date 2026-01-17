import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';
import { startOfMonth, subMonths, format, startOfYear, endOfYear, parseISO } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const user = token;
  const perms = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
  if (!perms?.viewOnly) return res.status(403).json({ message: 'Forbidden' });

  const { type, dateFrom, dateTo, modality } = req.query;

  try {
    if (type === 'monthly') {
      // Monthly trends: last 12 months, filtered by modality
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(startOfMonth(now), i);
        months.push({
          label: format(d, 'MMM yyyy'),
          start: d,
          end: subMonths(startOfMonth(now), i - 1)
        });
      }
      months[months.length - 1].end = now;
      const data = [];
      for (const m of months) {
        const where: any = {
          procedureDate: {
            gte: m.start,
            lt: m.end
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
    if (type === 'modality') {
      // Modality trends: x-axis modality, y-axis count, filtered by date
      const modalities = ['USG', 'CT', 'OT', 'Fluoroscopy', 'DSA'];
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
    if (type === 'yearly') {
      // Yearly trends: x-axis year, y-axis count, filtered by modality
      let where: any = {};
      if (modality && modality !== 'All') {
        where.modality = modality;
      }
      // Find first and last year
      const first = await prisma.procedureLog.findFirst({ orderBy: { procedureDate: 'asc' }, select: { procedureDate: true } });
      const last = await prisma.procedureLog.findFirst({ orderBy: { procedureDate: 'desc' }, select: { procedureDate: true } });
      if (!first || !last) return res.json({ labels: [], data: [] });
      const startYear = first.procedureDate.getFullYear();
      const endYear = last.procedureDate.getFullYear();
      const data = [];
      for (let y = startYear; y <= endYear; y++) {
        const yearStart = startOfYear(new Date(y, 0, 1));
        const yearEnd = endOfYear(new Date(y, 0, 1));
        const count = await prisma.procedureLog.count({
          where: {
            ...where,
            procedureDate: {
              gte: yearStart,
              lte: yearEnd
            }
          }
        });
        data.push({ label: y.toString(), count });
      }
      return res.json({ labels: data.map(d => d.label), data: data.map(d => d.count) });
    }
    return res.status(400).json({ message: 'Invalid type' });
  } catch (e) {
    console.error('Analytics API error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 