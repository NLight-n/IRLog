import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const userId = parseInt(String(token.id || token.userID), 10);
  const perms = (token as any)?.permissions || {};
  const isRequisitionOnly = !!perms.requisitionOnly;

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

  const current = await prisma.procedureRequest.findUnique({
    where: { id },
    include: { workItem: true },
  });
  if (!current) return res.status(404).json({ message: 'Procedure request not found' });

  if (req.method === 'GET') {
    return res.status(200).json(current);
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    // Only editable in 'Submitted' status
    if (current.status !== 'Submitted') {
      return res.status(400).json({
        message: 'Procedure requests cannot be edited once accepted or scheduled.',
      });
    }

    try {
      const body = req.body || {};
      const updateData: any = {};

      if (body.patientName !== undefined) updateData.patientName = body.patientName;
      if (body.patientAge !== undefined) updateData.patientAge = body.patientAge ? parseInt(String(body.patientAge), 10) : null;
      if (body.patientSex !== undefined) updateData.patientSex = body.patientSex || null;
      if (body.hospitalID !== undefined) updateData.hospitalID = body.hospitalID;
      if (body.patientType !== undefined) {
        updateData.patientType = body.patientType;
        if (body.patientType !== 'IP') {
          updateData.ward = null;
        }
      }
      if (body.ward !== undefined && updateData.patientType !== 'OP') {
        updateData.ward = body.ward || null;
      }
      if (body.procedure !== undefined) updateData.procedure = body.procedure;
      if (body.otherProcedure !== undefined) updateData.otherProcedure = body.otherProcedure || null;
      if (body.fromWhere !== undefined) updateData.fromWhere = body.fromWhere;
      if (body.samplesAnalysis !== undefined) updateData.samplesAnalysis = Array.isArray(body.samplesAnalysis) ? body.samplesAnalysis : [];
      if (body.otherSamples !== undefined) updateData.otherSamples = body.otherSamples || null;
      if (body.requesterDesignation !== undefined) updateData.requesterDesignation = body.requesterDesignation || null;
      if (body.requesterName !== undefined) updateData.requesterName = body.requesterName || null;
      if (body.requesterContact !== undefined) updateData.requesterContact = body.requesterContact || null;
      if (body.urgency !== undefined) updateData.urgency = body.urgency || 'Routine';
      if (body.clinicalNotes !== undefined) updateData.clinicalNotes = body.clinicalNotes || null;
      if (body.referringConsultant !== undefined) updateData.referringConsultant = body.referringConsultant || null;
      if (body.modality !== undefined) updateData.modality = body.modality || null;

      updateData.updatedById = userId || null;

      const updated = await prisma.procedureRequest.update({
        where: { id },
        data: updateData,
        include: { workItem: true },
      });

      if (userId) {
        await logAuditEvent({
          actionType: 'UPDATE',
          userID: userId,
          affectedTable: 'ProcedureRequest',
          affectedRowID: id,
          dataBefore: current,
          dataAfter: updated,
        });
      }

      return res.status(200).json(updated);
    } catch (err: any) {
      console.error('Error updating procedure request:', err);
      return res.status(500).json({ message: 'Failed to update procedure request' });
    }
  }

  if (req.method === 'DELETE') {
    // Check permission:
    // "Submitted requests can be edited as well as deleted, but once Accepted, users with requisitionOnly permission can't delete it. they can just view the details."
    if (current.status !== 'Submitted' && isRequisitionOnly) {
      return res.status(403).json({
        message: 'Accepted or scheduled procedure requests cannot be deleted by requisition-only users.',
      });
    }

    try {
      // If linked with work item, unlink or delete work item
      if (current.workItemId) {
        await prisma.workItem.delete({ where: { id: current.workItemId } }).catch(() => {});
      }

      await prisma.procedureRequest.delete({ where: { id } });

      if (userId) {
        await logAuditEvent({
          actionType: 'DELETE',
          userID: userId,
          affectedTable: 'ProcedureRequest',
          affectedRowID: id,
          dataBefore: current,
        });
      }

      return res.status(204).end();
    } catch (err: any) {
      console.error('Error deleting procedure request:', err);
      return res.status(500).json({ message: 'Failed to delete procedure request' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
