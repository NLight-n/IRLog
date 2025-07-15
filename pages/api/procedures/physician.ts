import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const perms = Array.isArray(token.permissions) ? token.permissions[0] : token.permissions;

  if (req.method === 'GET') {
    // List all physicians
    const physicians = await prisma.physician.findMany();
    return res.status(200).json(physicians);
  }

  if (req.method === 'POST') {
    if (!perms?.editSettings) return res.status(403).json({ message: 'Forbidden' });
    const data = req.body;
    const created = await prisma.physician.create({ data });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'CREATE',
        userID: userId,
        affectedTable: 'Physician',
        affectedRowID: created.physicianID,
        dataAfter: created,
      });
    }
    
    return res.status(201).json(created);
  }

  if (req.method === 'PATCH') {
    if (!perms?.editSettings) return res.status(403).json({ message: 'Forbidden' });
    const { physicianID, ...data } = req.body;
    
    // Get current data for audit log
    const currentData = await prisma.physician.findUnique({ where: { physicianID } });
    
    const updated = await prisma.physician.update({ where: { physicianID }, data });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'UPDATE',
        userID: userId,
        affectedTable: 'Physician',
        affectedRowID: physicianID,
        dataBefore: currentData,
        dataAfter: updated,
      });
    }
    
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    if (!perms?.editSettings) return res.status(403).json({ message: 'Forbidden' });
    const { physicianID } = req.body;
    
    // Get current data for audit log
    const currentData = await prisma.physician.findUnique({ where: { physicianID } });
    
    await prisma.physician.delete({ where: { physicianID } });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'DELETE',
        userID: userId,
        affectedTable: 'Physician',
        affectedRowID: physicianID,
        dataBefore: currentData,
      });
    }
    
    return res.status(204).end();
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 