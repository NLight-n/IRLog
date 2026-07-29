import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
  }

  const user = session.user as any;
  const challenge = crypto.randomBytes(32).toString('base64url');

  // Return options object
  return res.status(200).json({
    challenge,
    rpName: 'IRLog Procedure Register',
    user: {
      id: parseInt(user.id || user.userID || '1', 10),
      username: user.username || user.name || user.email,
    },
  });
}
