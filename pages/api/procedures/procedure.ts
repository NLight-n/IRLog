import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  console.log('JWT TOKEN:', JSON.stringify(token));
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const perms = Array.isArray(token.permissions) ? token.permissions[0] : token.permissions;

  if (req.method === 'GET') {
    // List all procedures
    const procedures = await prisma.procedure.findMany();
    return res.status(200).json(procedures);
  }

  if (req.method === 'POST') {
    if (!perms?.editSettings) return res.status(403).json({ message: 'Forbidden' });
    const data = req.body;
    if (typeof data.procedureCost === 'string' && data.procedureCost !== '') {
      data.procedureCost = parseFloat(data.procedureCost);
    }
    if (data.procedureCost === '') {
      data.procedureCost = null;
    }
    const created = await prisma.procedure.create({ data });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'CREATE',
        userID: userId,
        affectedTable: 'Procedure',
        affectedRowID: created.proID,
        dataAfter: created,
      });
    }
    
    return res.status(201).json(created);
  }

  if (req.method === 'PATCH') {
    if (!perms?.editSettings) return res.status(403).json({ message: 'Forbidden' });
    const { proID, ...data } = req.body;
    
    // Get current data for audit log
    const currentData = await prisma.procedure.findUnique({ where: { proID } });
    
    if (typeof data.procedureCost === 'string' && data.procedureCost !== '') {
      data.procedureCost = parseFloat(data.procedureCost);
    }
    if (data.procedureCost === '') {
      data.procedureCost = null;
    }
    const updated = await prisma.procedure.update({ where: { proID }, data });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'UPDATE',
        userID: userId,
        affectedTable: 'Procedure',
        affectedRowID: proID,
        dataBefore: currentData,
        dataAfter: updated,
      });
    }
    
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    if (!perms?.editSettings) return res.status(403).json({ message: 'Forbidden' });
    const { proID } = req.body;
    
    // Get current data for audit log
    const currentData = await prisma.procedure.findUnique({ where: { proID } });
    
    await prisma.procedure.delete({ where: { proID } });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'DELETE',
        userID: userId,
        affectedTable: 'Procedure',
        affectedRowID: proID,
        dataBefore: currentData,
      });
    }
    
    return res.status(204).end();
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 