import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  const sess: any = session;
  if (!sess.user) return res.status(401).json({ message: 'Unauthorized' });

  if (req.method === 'GET') {
    // Return all procedures for dropdown selection
    const allProcedures = await prisma.procedure.findMany();
    return res.status(200).json(allProcedures);
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 