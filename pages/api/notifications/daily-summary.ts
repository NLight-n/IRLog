import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';
import { sendPushNotification } from '../../../lib/pushNotification';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Allow call via session authentication OR cron header authorization
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'irlog-daily-cron-secret';
  const isCronAuth = authHeader === `Bearer ${cronSecret}` || req.query.secret === cronSecret;

  if (!isCronAuth) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized. Login required or provide valid cron secret.' });
    }
  }

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Fetch work items scheduled for today
    const todayItems = await prisma.workItem.findMany({
      where: {
        dateScheduled: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { dateScheduled: 'asc' },
    });

    const totalCount = todayItems.length;

    // Group modalities
    const modalityCounts: Record<string, number> = {};
    todayItems.forEach((item) => {
      const mod = item.modality || 'General';
      modalityCounts[mod] = (modalityCounts[mod] || 0) + 1;
    });

    const modalitySummary = Object.entries(modalityCounts)
      .map(([mod, cnt]) => `${mod}: ${cnt}`)
      .join(', ');

    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    let title = `🌅 Morning Worklist Update (${dateStr})`;
    let body = totalCount === 0
      ? `Good morning! No procedures currently scheduled for today (${dateStr}).`
      : `Good morning! You have ${totalCount} procedure(s) scheduled for today.${modalitySummary ? ` (${modalitySummary})` : ''}`;

    // Send push notification to all subscribers
    const pushResult = await sendPushNotification({
      title,
      body,
      url: '/worklist',
    });

    return res.status(200).json({
      ok: true,
      date: dateStr,
      scheduledCount: totalCount,
      modalities: modalityCounts,
      pushResult,
      message: `Daily morning update pushed to ${pushResult.sent} device(s).`,
    });
  } catch (err: any) {
    console.error('Error generating daily summary push notification:', err);
    return res.status(500).json({
      ok: false,
      message: err.message || 'Failed to generate daily summary notification',
    });
  }
}
