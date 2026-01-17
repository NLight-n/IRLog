import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const user = (session as any).user;
  if (!session || !user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    let where = {};
    if (req.query.role) {
      where = { role: { equals: String(req.query.role), mode: 'insensitive' } };
    }
    const physicians = await prisma.physician.findMany({ where });
    return res.status(200).json(physicians);
  }

  if (req.method === 'POST') {
    if (!user.permissions?.editSettings) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const data = req.body;
    // TODO: Validate data
    const created = await prisma.physician.create({ data });
    return res.status(201).json(created);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export default handler; 