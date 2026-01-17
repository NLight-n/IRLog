import { prisma } from '../../../lib/prisma/prisma';
import { withAuth } from '../auth/middleware';
import type { NextApiRequest, NextApiResponse } from 'next';

interface NextApiRequestWithUser extends NextApiRequest {
  user?: unknown;
}

async function handler(req: NextApiRequestWithUser, res: NextApiResponse) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const physicianID = parseInt(req.query.id as string);
  if (isNaN(physicianID)) {
    return res.status(400).json({ message: 'Invalid physician ID' });
  }

  if (req.method === 'GET') {
    const found = await prisma.physician.findUnique({ where: { physicianID } });
    if (!found) return res.status(404).json({ message: 'Not found' });
    return res.status(200).json(found);
  }

  if (req.method === 'PATCH') {
    const permissions = (user && typeof user === "object" && "permissions" in user)
      ? (user as { permissions?: string[] | string }).permissions
      : undefined;
    const isAdmin = Array.isArray(permissions)
      ? permissions.includes('admin')
      : permissions === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const data = req.body;
    // TODO: Validate data
    const updated = await prisma.physician.update({ where: { physicianID }, data });
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const permissions = (user && typeof user === "object" && "permissions" in user)
      ? (user as { permissions?: string[] | string }).permissions
      : undefined;
    const isAdmin = Array.isArray(permissions)
      ? permissions.includes('admin')
      : permissions === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await prisma.physician.delete({ where: { physicianID } });
    return res.status(204).end();
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export default withAuth(handler as (req: NextApiRequest, res: NextApiResponse) => Promise<void>); 