import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const userId = parseInt(String(token.id || token.userID));

  if (req.method === 'GET') {
    const items = await prisma.workItem.findMany({ orderBy: { updatedAt: 'desc' } });
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    const dbPerms = await prisma.permission.findFirst({ where: { userID: userId } });
    if (!dbPerms?.editProcedureLog) return res.status(403).json({ message: 'Forbidden' });
    const data = req.body || {};
    const now = new Date().toISOString();
    const created = await prisma.workItem.create({
      data: {
        patientID: data.patientID,
        patientName: data.patientName,
        procedureName: data.procedureName,
        modality: data.modality || null,
        notes: data.notes || null,
        stage: 'Pending',
        dateAdded: now as unknown as Date,
        createdById: userId || null,
      },
    });

    await logAuditEvent({
      actionType: 'CREATE',
      userID: userId,
      affectedTable: 'WorkItem',
      affectedRowID: created.id,
      dataAfter: created,
    });
    return res.status(201).json(created);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

