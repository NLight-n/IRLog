import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const perms = (session.user as any)?.permissions || {};

  if (req.method === 'GET') {
    try {
      const holidays = await prisma.holiday.findMany({
        orderBy: { date: 'asc' },
      });
      return res.status(200).json(holidays);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to fetch holidays' });
    }
  }

  if (req.method === 'POST') {
    if (!perms.editSettings && !perms.editProcedureLog) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { date, name, type } = req.body;
    if (!date || !name) {
      return res.status(400).json({ error: 'Date and Name are required' });
    }
    try {
      const holiday = await prisma.holiday.upsert({
        where: { date },
        update: { name, type: type || 'Festival' },
        create: { date, name, type: type || 'Festival' },
      });
      return res.status(200).json(holiday);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to save holiday' });
    }
  }

  if (req.method === 'DELETE') {
    if (!perms.editSettings && !perms.editProcedureLog) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing holiday ID' });
    }
    try {
      await prisma.holiday.delete({
        where: { id: Number(id) },
      });
      return res.status(200).json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to delete holiday' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
