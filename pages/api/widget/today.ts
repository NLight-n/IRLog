import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../lib/prisma/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 1. Authenticate via Bearer header or NextAuth session
  let userPayload: any = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'irlog_widget_fallback_secret_key';
    try {
      userPayload = jwt.verify(token, secret);
    } catch {
      try {
        userPayload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired widget token' });
      }
    }
  } else {
    userPayload = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  }

  if (!userPayload) {
    return res.status(401).json({ message: 'Unauthorized. Please provide a valid Bearer token.' });
  }

  try {
    const { date, tzOffset } = req.query;
    const offsetMin = typeof tzOffset === 'string' ? parseInt(tzOffset, 10) : null;

    // Target date calculation
    let targetDateStr = typeof date === 'string' ? date : '';
    if (!targetDateStr) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      targetDateStr = `${year}-${month}-${day}`;
    }

    // Fetch all work items with scheduled status
    const allItems = await prisma.workItem.findMany({
      orderBy: [
        { appointmentTime: 'asc' },
        { displayOrder: 'asc' },
        { id: 'asc' },
      ],
    });

    // Filter items for target date
    const todayItems = allItems.filter(item => {
      if (!item.dateScheduled) return false;
      const d = new Date(item.dateScheduled);

      let dateKey = '';
      if (offsetMin !== null && !isNaN(offsetMin)) {
        const clientLocalTime = new Date(d.getTime() - offsetMin * 60 * 1000);
        const year = clientLocalTime.getUTCFullYear();
        const month = String(clientLocalTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(clientLocalTime.getUTCDate()).padStart(2, '0');
        dateKey = `${year}-${month}-${day}`;
      } else {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateKey = `${year}-${month}-${day}`;
      }
      return dateKey === targetDateStr;
    });

    // Summary stats
    const totalCount = todayItems.length;
    const scheduledCount = todayItems.filter(i => i.status === 'Scheduled').length;
    const doneCount = todayItems.filter(i => i.status === 'Done').length;
    const notDoneCount = todayItems.filter(i => i.status === 'NotDone').length;
    const cancelledCount = todayItems.filter(i => i.status === 'Cancelled').length;

    // Format items cleanly for the widget
    const formattedItems = todayItems.map(item => ({
      id: item.id,
      patientID: item.patientID || '',
      patientName: item.patientName || 'Unnamed Patient',
      patientAge: item.patientAge,
      patientSex: item.patientSex,
      procedureName: item.procedureName || 'Procedure',
      modality: (item.modality || 'IR').toUpperCase(),
      appointmentTime: item.appointmentTime || '',
      status: item.status || 'Scheduled',
      stage: item.stage || 'Scheduled',
      notes: item.notes || '',
      displayOrder: item.displayOrder,
    }));

    return res.status(200).json({
      date: targetDateStr,
      serverTime: new Date().toISOString(),
      summary: {
        total: totalCount,
        scheduled: scheduledCount,
        done: doneCount,
        notDone: notDoneCount,
        cancelled: cancelledCount,
      },
      items: formattedItems,
    });
  } catch (error: any) {
    console.error('Error in widget today API:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
