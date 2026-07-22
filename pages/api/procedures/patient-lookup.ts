import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  const sess: any = session;
  if (!sess.user) return res.status(401).json({ message: 'Unauthorized' });

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { patientID } = req.query;
  if (!patientID || typeof patientID !== 'string') {
    return res.status(400).json({ message: 'Missing patientID parameter' });
  }

  const trimmedID = patientID.trim();
  if (!trimmedID) {
    return res.status(400).json({ message: 'Invalid patientID parameter' });
  }

  try {
    const latestLog = await prisma.procedureLog.findFirst({
      where: {
        patientID: trimmedID,
      },
      orderBy: {
        procedureDate: 'desc',
      },
      select: {
        patientName: true,
        patientAge: true,
        patientSex: true,
        createdAt: true,
      },
    });

    const latestWorkItem = await prisma.workItem.findFirst({
      where: {
        patientID: trimmedID,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        patientName: true,
        patientAge: true,
        patientSex: true,
        createdAt: true,
      },
    });

    if (!latestLog && latestWorkItem) {
      return res.status(200).json({
        patientName: latestWorkItem.patientName,
        patientAge: latestWorkItem.patientAge,
        patientSex: latestWorkItem.patientSex,
      });
    }

    if (latestLog && latestWorkItem) {
      if (new Date(latestWorkItem.createdAt) > new Date(latestLog.createdAt)) {
        return res.status(200).json({
          patientName: latestWorkItem.patientName,
          patientAge: latestWorkItem.patientAge,
          patientSex: latestWorkItem.patientSex,
        });
      }
    }

    return res.status(200).json(latestLog ? {
      patientName: latestLog.patientName,
      patientAge: latestLog.patientAge,
      patientSex: latestLog.patientSex,
    } : null);
  } catch (error: any) {
    console.error('Error looking up patient:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
