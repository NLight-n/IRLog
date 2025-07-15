import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import { verifyJwt } from '../../../lib/auth/jwt';

interface NextApiRequestWithUser extends NextApiRequest {
  user?: unknown;
}

export function withAuth(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid token' });
    }
    const token = authHeader.split(' ')[1];
    const user = verifyJwt(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    (req as NextApiRequestWithUser).user = user;
    return handler(req as NextApiRequestWithUser, res);
  };
} 