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
      include: { workItem: true },
    });
    if (!current) return res.status(404).json({ message: 'Procedure request not found' });

    // 1. Delete linked work item if exists
    if (current.workItemId) {
      await prisma.workItem.delete({ where: { id: current.workItemId } }).catch(() => {});
    }

    // 2. Revert ProcedureRequest to Submitted
    const updated = await prisma.procedureRequest.update({
      where: { id },
      data: {
        status: 'Submitted',
        scheduledDate: null,
        scheduledTime: null,
        modality: null,
        workItemId: null,
        updatedById: userId || null,
      },
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

    return res.status(200).json({ ok: true, request: updated });
  } catch (err: any) {
    console.error('Error reverting procedure request:', err);
    return res.status(500).json({ message: 'Failed to revert procedure request' });
  }
}
