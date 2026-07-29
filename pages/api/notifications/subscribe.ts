import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const userId = parseInt(String(token.id || token.userID));

  if (req.method === 'POST') {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ message: 'Invalid subscription object.' });
    }

    try {
      // Avoid duplicate endpoints for other/old users
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: subscription.endpoint },
      });

      // Save the new subscription
      const saved = await prisma.pushSubscription.create({
        data: {
          userID: userId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
      });

      return res.status(201).json({ ok: true, saved });
    } catch (err: any) {
      console.error('Error saving push subscription:', err);
      return res.status(500).json({ message: 'Failed to register push subscription.' });
    }
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint parameter is required.' });
    }

    try {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint,
          userID: userId,
        },
      });
      return res.status(200).json({ ok: true, message: 'Unsubscribed successfully.' });
    } catch (err: any) {
      console.error('Error unsubscribing push subscription:', err);
      return res.status(500).json({ message: 'Failed to delete push subscription.' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
