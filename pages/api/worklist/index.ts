import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';
import { logAuditEvent } from '../../../lib/auditLogger';
import { sendPushNotification } from '../../../lib/pushNotification';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const userId = parseInt(String(token.id || token.userID));

  if (req.method === 'GET') {
    const items = await prisma.workItem.findMany({
      orderBy: [
        { dateScheduled: 'asc' },
        { displayOrder: 'asc' },
        { id: 'asc' },
      ],
    });
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    const dbPerms = await prisma.permission.findFirst({ where: { userID: userId } });
    if (!dbPerms?.editProcedureLog) return res.status(403).json({ message: 'Forbidden' });
    const data = req.body || {};
    const now = new Date();
    const created = await prisma.workItem.create({
      data: {
        patientID: data.patientID,
        patientName: data.patientName,
        patientAge: data.patientAge ? parseInt(String(data.patientAge), 10) : null,
        patientSex: data.patientSex || null,
        procedureName: data.procedureName,
        modality: data.modality || null,
        appointmentTime: data.appointmentTime || null,
        status: data.status || 'Scheduled',
        notDoneReason: data.notDoneReason || null,
        displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        stage: data.stage || 'Scheduled',
        dateScheduled: data.dateScheduled ? new Date(data.dateScheduled) : now,
        dateAdded: now,
        notes: data.notes || null,
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

    // Send push notification in background
    const creatorName = String((token as any).username || 'A user');
    const patientName = created.patientName || 'Unnamed Patient';
    const modality = created.modality || 'IR';
    const procedureName = created.procedureName || 'Procedure';

    await sendPushNotification({
      title: '📅 New Appointment Scheduled',
      body: `${patientName} scheduled for ${procedureName} (${modality}) by ${creatorName}`,
      url: '/worklist',
    }).catch(err => console.error('Failed to trigger push notification:', err));

    return res.status(201).json(created);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

