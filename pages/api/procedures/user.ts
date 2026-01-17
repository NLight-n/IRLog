import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const perms = Array.isArray(token.permissions) ? token.permissions[0] : token.permissions;

  if (req.method === 'GET') {
    // List all users with permissions
    const users = await prisma.user.findMany({
      include: { permissions: true },
      orderBy: { userID: 'asc' },
    });
    return res.status(200).json(users);
  }

  if (req.method === 'POST') {
    if (!perms?.manageUsers) return res.status(403).json({ message: 'Forbidden' });
    const { username, email, password, role, permissions } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
        role,
        permissions: { create: permissions },
      },
      include: { permissions: true },
    });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'CREATE',
        userID: userId,
        affectedTable: 'User',
        affectedRowID: created.userID,
        dataAfter: { ...created, password: '[HIDDEN]' },
      });
    }
    
    return res.status(201).json(created);
  }

  if (req.method === 'PATCH') {
    // Forward to /api/users/[id] or return a clear error
    return res.status(405).json({ message: 'Not allowed. Use /api/users/[id] for user updates.' });
  }

  if (req.method === 'DELETE') {
    if (!perms?.manageUsers) return res.status(403).json({ message: 'Forbidden' });
    const { userID } = req.body;
    
    // Get current data for audit log
    const currentData = await prisma.user.findUnique({
      where: { userID },
      include: { permissions: true },
    });
    
    // Delete permissions first to avoid FK constraint error
    await prisma.permission.deleteMany({ where: { userID } });
    await prisma.user.delete({ where: { userID } });
    
    // Log audit event
    const userId = parseInt(String(token.id || token.userID));
    if (userId) {
      await logAuditEvent({
        actionType: 'DELETE',
        userID: userId,
        affectedTable: 'User',
        affectedRowID: userID,
        dataBefore: currentData ? { ...currentData, password: '[HIDDEN]' } : null,
      });
    }
    
    return res.status(204).end();
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 