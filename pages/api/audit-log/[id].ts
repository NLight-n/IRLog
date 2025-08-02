import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  const sess: unknown = session;
  if (!sess || typeof sess !== 'object' || !('user' in sess)) return res.status(401).json({ message: 'Unauthorized' });
  const user = (sess as { user: { permissions?: string[] | string } }).user;
  const permissions = user?.permissions;
  const hasViewOnly = Array.isArray(permissions)
    ? permissions.includes('viewOnly')
    : permissions === 'viewOnly';
  
  // Allow access with viewOnly permission (minimum requirement for viewing audit logs)
  if (!hasViewOnly) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const logID = parseInt(req.query.id as string);
  if (isNaN(logID)) {
    return res.status(400).json({ message: 'Invalid log ID' });
  }
  if (req.method === 'GET') {
    const log = await prisma.auditLog.findUnique({ where: { logID } });
    if (!log) return res.status(404).json({ message: 'Not found' });
    return res.status(200).json(log);
  }
  return res.status(405).json({ message: 'Method not allowed' });
} 