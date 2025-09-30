import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';
import { logAuditEvent } from '../../../lib/auditLogger';

const STAGE_DATE_FIELD: Record<string, keyof import('@prisma/client').WorkItem> = {
  Pending: 'dateAdded',
  OnEvaluation: 'dateEvaluated',
  Scheduled: 'dateScheduled',
  Done: 'dateDone',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const userId = parseInt(String((token as any).id || (token as any).userID));
  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  if (req.method === 'PATCH') {
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    const dbPerms = await prisma.permission.findFirst({ where: { userID: userId } });
    if (!dbPerms?.editProcedureLog) return res.status(403).json({ message: 'Forbidden' });
    const body = req.body || {};
    const data: any = {};
    if (body.stage && typeof body.stage === 'string') {
      const stage = body.stage as keyof typeof STAGE_DATE_FIELD;
      data.stage = stage;
      const dateField = STAGE_DATE_FIELD[stage];
      if (dateField) {
        // Allow explicit date override (e.g., for Scheduled lane drop)
        if (stage === 'Scheduled' && body.dateScheduled) {
          data.dateScheduled = new Date(body.dateScheduled);
        } else if (stage === 'OnEvaluation' && body.dateEvaluated) {
          data.dateEvaluated = new Date(body.dateEvaluated);
        } else if (stage === 'Pending' && body.dateAdded) {
          data.dateAdded = new Date(body.dateAdded);
        } else if (stage === 'Done' && body.dateDone) {
          data.dateDone = new Date(body.dateDone);
        } else {
          data[dateField] = new Date();
        }
      }
    }
    // Allow updating dates independently (without changing stage)
    if (body.dateScheduled) data.dateScheduled = new Date(body.dateScheduled);
    if (body.dateEvaluated) data.dateEvaluated = new Date(body.dateEvaluated);
    if (body.dateAdded) data.dateAdded = new Date(body.dateAdded);
    if (body.dateDone) data.dateDone = new Date(body.dateDone);
    if (typeof body.patientName === 'string') data.patientName = body.patientName;
    if (typeof body.patientID === 'string') data.patientID = body.patientID;
    if (typeof body.procedureName === 'string') data.procedureName = body.procedureName;
    if (typeof body.modality === 'string') data.modality = body.modality;
    if (typeof body.notes === 'string') data.notes = body.notes || null;

    const before = await prisma.workItem.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Not found' });

    const updated = await prisma.workItem.update({
      where: { id },
      data: { ...data, updatedById: userId || null },
    });

    await logAuditEvent({
      actionType: 'UPDATE',
      userID: userId,
      affectedTable: 'WorkItem',
      affectedRowID: id,
      dataBefore: before,
      dataAfter: updated,
    });

    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    const dbPerms = await prisma.permission.findFirst({ where: { userID: userId } });
    if (!dbPerms?.editProcedureLog) return res.status(403).json({ message: 'Forbidden' });
    const before = await prisma.workItem.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Not found' });
    await prisma.workItem.delete({ where: { id } });
    await logAuditEvent({
      actionType: 'DELETE',
      userID: userId,
      affectedTable: 'WorkItem',
      affectedRowID: id,
      dataBefore: before,
    });
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const item = await prisma.workItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: 'Not found' });
    return res.status(200).json(item);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

