import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';
import { logAuditEvent } from '../../../lib/auditLogger';
import { sendPushNotification } from '../../../lib/pushNotification';

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

  if (req.method === 'PATCH' || req.method === 'PUT') {
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    const dbPerms = await prisma.permission.findFirst({ where: { userID: userId } });
    if (!dbPerms?.editApptCard) return res.status(403).json({ message: 'Forbidden' });
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
    if (body.patientAge !== undefined) data.patientAge = body.patientAge === null || body.patientAge === '' ? null : parseInt(String(body.patientAge), 10);
    if (body.patientSex !== undefined) data.patientSex = body.patientSex || null;
    if (typeof body.procedureName === 'string') data.procedureName = body.procedureName;
    if (body.modality !== undefined) data.modality = body.modality || null;
    if (body.appointmentTime !== undefined) data.appointmentTime = body.appointmentTime || null;
    if (typeof body.status === 'string') data.status = body.status;
    if (body.notDoneReason !== undefined) data.notDoneReason = body.notDoneReason || null;
    if (typeof body.displayOrder === 'number') data.displayOrder = body.displayOrder;
    if (body.notes !== undefined) data.notes = body.notes || null;

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

    // Send push notification for updates with detailed change description
    const editorName = String((token as any).username || 'A user');
    const patientName = updated.patientName || before.patientName || 'Unnamed Patient';
    const modality = updated.modality || before.modality || 'IR';
    const procedureName = updated.procedureName || before.procedureName || 'Procedure';

    // Build specific change descriptions
    const changes: string[] = [];
    const fmtDate = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

    // Status changes (Not Done, Cancelled, etc.)
    if (before.status !== updated.status) {
      if (updated.status === 'Not Done') {
        const reason = updated.notDoneReason ? ` — ${updated.notDoneReason}` : '';
        changes.push(`Marked as Not Done${reason}`);
      } else if (updated.status === 'Cancelled') {
        changes.push('Marked as Cancelled');
      } else {
        changes.push(`Status → ${updated.status}`);
      }
    } else if (before.notDoneReason !== updated.notDoneReason && updated.notDoneReason) {
      changes.push(`Not-done reason updated: ${updated.notDoneReason}`);
    }

    // Stage transitions
    if (before.stage !== updated.stage) {
      const stageLabels: Record<string, string> = {
        Pending: 'Pending',
        OnEvaluation: 'On Evaluation',
        Scheduled: 'Scheduled',
        Done: 'Done',
      };
      changes.push(`Moved to ${stageLabels[updated.stage ?? ''] || updated.stage}`);
    }

    // Date changes
    if (fmtDate(before.dateScheduled) !== fmtDate(updated.dateScheduled) && updated.dateScheduled) {
      const fromStr = fmtDate(before.dateScheduled);
      changes.push(fromStr
        ? `Rescheduled from ${fromStr} → ${fmtDate(updated.dateScheduled)}`
        : `Scheduled for ${fmtDate(updated.dateScheduled)}`);
    }
    if (fmtDate(before.dateDone) !== fmtDate(updated.dateDone) && updated.dateDone) {
      changes.push(`Completed on ${fmtDate(updated.dateDone)}`);
    }
    if (fmtDate(before.dateEvaluated) !== fmtDate(updated.dateEvaluated) && updated.dateEvaluated) {
      changes.push(`Evaluated on ${fmtDate(updated.dateEvaluated)}`);
    }

    // Appointment time change
    if (before.appointmentTime !== updated.appointmentTime && updated.appointmentTime) {
      changes.push(`Time changed to ${updated.appointmentTime}`);
    }

    // Procedure / modality change
    if (before.procedureName !== updated.procedureName && updated.procedureName) {
      changes.push(`Procedure → ${updated.procedureName}`);
    }
    if (before.modality !== updated.modality && updated.modality) {
      changes.push(`Modality → ${updated.modality}`);
    }

    // Patient info change
    if (before.patientName !== updated.patientName && updated.patientName) {
      changes.push(`Patient name → ${updated.patientName}`);
    }

    // Notes change
    if (before.notes !== updated.notes && updated.notes) {
      changes.push('Notes updated');
    }

    // Pick notification title emoji & text based on the most significant change
    let notifTitle = '✏️ Appointment Updated';
    if (updated.status === 'Not Done' && before.status !== updated.status) {
      notifTitle = '⚠️ Appointment Not Done';
    } else if (updated.status === 'Cancelled' && before.status !== updated.status) {
      notifTitle = '🚫 Appointment Cancelled';
    } else if (before.stage !== updated.stage && updated.stage === 'Done') {
      notifTitle = '✅ Appointment Completed';
    } else if (before.stage !== updated.stage && updated.stage === 'Scheduled') {
      notifTitle = '📅 Appointment Scheduled';
    } else if (fmtDate(before.dateScheduled) !== fmtDate(updated.dateScheduled)) {
      notifTitle = '📅 Appointment Rescheduled';
    }

    const bodyText = changes.length > 0
      ? `${patientName} (${procedureName}): ${changes.join(' • ')} — by ${editorName}`
      : `${patientName}'s appointment updated by ${editorName}`;

    await sendPushNotification({
      title: notifTitle,
      body: bodyText,
      url: '/worklist',
    }).catch(err => console.error('Failed to trigger push notification:', err));

    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    const dbPerms = await prisma.permission.findFirst({ where: { userID: userId } });
    if (!dbPerms?.editApptCard) return res.status(403).json({ message: 'Forbidden' });
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

    // Send push notification for deletion
    const editorName = String((token as any).username || 'A user');
    const patientName = before.patientName || 'Unnamed Patient';
    const modality = before.modality || 'IR';
    const procedureName = before.procedureName || 'Procedure';

    await sendPushNotification({
      title: '❌ Appointment Cancelled',
      body: `${patientName} (${procedureName} - ${modality}) cancelled by ${editorName}`,
      url: '/worklist',
    }).catch(err => console.error('Failed to trigger push notification:', err));

    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const item = await prisma.workItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: 'Not found' });
    return res.status(200).json(item);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

