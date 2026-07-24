import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { date, tzOffset } = req.query;
    const offsetMin = typeof tzOffset === 'string' ? parseInt(tzOffset, 10) : null;

    let targetDateStr = typeof date === 'string' ? date : '';
    if (!targetDateStr) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      targetDateStr = `${year}-${month}-${day}`;
    }

    const items = await prisma.workItem.findMany({
      select: { dateScheduled: true, status: true },
    });

    const count = items.filter(item => {
      // Only count items with status 'Scheduled' (excludes Done, NotDone, Cancelled)
      if (item.status !== 'Scheduled') return false;
      if (!item.dateScheduled) return false;
      const d = new Date(item.dateScheduled);
      
      let dateKey = '';
      if (offsetMin !== null && !isNaN(offsetMin)) {
        // Adjust for client timezone offset (getTimezoneOffset returns minutes difference: UTC - local)
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
    }).length;

    return res.status(200).json({ count });
  } catch (error: any) {
    console.error('Error fetching today count:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
