import type { NextApiRequest, NextApiResponse } from 'next';
import { vapidPublicKey } from '../../../lib/pushNotification';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const key = vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  if (!key) {
    return res.status(500).json({ message: 'VAPID public key not configured on server' });
  }

  return res.status(200).json({ publicKey: key });
}
