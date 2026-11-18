import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../../lib/prisma/prisma';
import { logAuditEvent } from '../../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const userId = parseInt(String(token.id || token.userID), 10);
  const perms = (token as any)?.permissions || {};

  if (!perms.editApptCard && !perms.manageUsers) {
    return res.status(403).json({ message: 'Forbidden: Requires editApptCard permission' });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    const current = await prisma.procedureRequest.findUnique({
      where: { id },
    });
    if (!current) return res.status(404).json({ message: 'Procedure request not found' });

    const { dateScheduled, appointmentTime, displayOrder = 0, modality } = req.body || {};
    if (!dateScheduled) {
      return res.status(400).json({ message: 'dateScheduled is required' });
    }

    const scheduledDateObj = new Date(dateScheduled);
    const procDisplayName =
      current.procedure === 'Others' && current.otherProcedure
        ? current.otherProcedure
        : current.procedure;

    // Compose clinical context into WorkItem notes
    const noteParts: string[] = [];
    if (current.fromWhere) noteParts.push(`Site: ${current.fromWhere}`);
    if (current.samplesAnalysis && current.samplesAnalysis.length > 0) {
      noteParts.push(`Samples: ${current.samplesAnalysis.join(', ')}`);
    }
    if (current.requesterDesignation || current.requesterName) {
      noteParts.push(`Req by: ${[current.requesterDesignation, current.requesterName].filter(Boolean).join(' ')}`);
    }
    if (current.clinicalNotes) noteParts.push(current.clinicalNotes);
    const combinedNotes = noteParts.join(' | ');

    // 1. Create or link WorkItem
    let workItem;
    if (current.workItemId) {
      // Re-updating existing
      workItem = await prisma.workItem.update({
        where: { id: current.workItemId },
        data: {
          dateScheduled: scheduledDateObj,
          appointmentTime: appointmentTime || null,
          modality: modality !== undefined ? (modality || null) : undefined,
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          status: 'Scheduled',
          stage: 'Scheduled',
          updatedById: userId || null,
        },
      });
    } else {
      workItem = await prisma.workItem.create({
        data: {
          patientID: current.hospitalID,
          patientName: current.patientName,
          patientAge: current.patientAge,
          patientSex: current.patientSex,
          procedureName: procDisplayName,
          modality: modality || null,
          patientType: current.patientType,
          ward: current.patientType === 'IP' ? current.ward : null,
          dateScheduled: scheduledDateObj,
          appointmentTime: appointmentTime || null,
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
          status: 'Scheduled',
          stage: 'Scheduled',
          notes: combinedNotes || null,
          createdById: userId || null,
        },
      });
    }

    // 2. Update ProcedureRequest
    const updatedRequest = await prisma.procedureRequest.update({
      where: { id },
      data: {
        status: 'Accepted',
        scheduledDate: scheduledDateObj,
        scheduledTime: appointmentTime || null,
        modality: modality || null,
        workItemId: workItem.id,
        updatedById: userId || null,
      },
      include: { workItem: true },
    });

    // 3. Audit log
    if (userId) {
      await logAuditEvent({
        actionType: 'UPDATE',
        userID: userId,
        affectedTable: 'ProcedureRequest',
        affectedRowID: id,
        dataBefore: current,
        dataAfter: updatedRequest,
      });
    }

    return res.status(200).json({
      request: updatedRequest,
      workItem,
    });
  } catch (err: any) {
    console.error('Error accepting procedure request:', err);
    return res.status(500).json({ message: 'Failed to accept procedure request' });
  }
}
