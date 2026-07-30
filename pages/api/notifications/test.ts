import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { sendPushNotification } from '../../../lib/pushNotification';
import { prisma } from '../../../lib/prisma/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = parseInt(String(token.id || (token as any).userID));
  if (!userId) {
    return res.status(400).json({ message: 'Invalid user session' });
  }

  try {
    // Check user's subscriptions
    const count = await prisma.pushSubscription.count({
      where: { userID: userId },
    });

    if (count === 0) {
      return res.status(404).json({
        ok: false,
        message: 'No push subscriptions found for your account on this server. Please enable push notifications first.',
      });
    }

    const result = await sendPushNotification({
      userID: userId,
      title: '🧪 Test Push Notification',
      body: `Hello ${token.name || token.email || 'Doctor'}! Push notifications are active and working on your device.`,
      url: '/worklist',
    });

    if (result.sent > 0) {
      return res.status(200).json({
        ok: true,
        sent: result.sent,
        total: result.total,
        message: `Successfully delivered test notification to ${result.sent} device(s)!`,
      });
    } else {
      const errDetails = result.errors && result.errors.length > 0 ? result.errors.join(' | ') : 'Unknown push failure';
      return res.status(500).json({
        ok: false,
        sent: 0,
        total: result.total,
        message: `Failed to deliver push notification: ${errDetails}`,
      });
    }
  } catch (err: any) {
    console.error('Error sending test push notification:', err);
    return res.status(500).json({
      ok: false,
      message: err.message || 'Error triggering test notification',
    });
  }
}
