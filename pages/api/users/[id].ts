import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { hashPassword } from '../../../lib/auth/password';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  console.log('DEBUG: full session object in /api/users/[id]:', JSON.stringify(session));
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  const sess: any = session;
  if (!sess.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = sess.user;
  console.log('DEBUG: user object in /api/users/[id]:', JSON.stringify(user));
  if (!user.permissions?.manageUsers) {
    console.error('403 Forbidden: session user', JSON.stringify(user));
    return res.status(403).json({ message: 'Forbidden' });
  }

  const userId = parseInt(req.query.id as string);
  if (isNaN(userId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  if (req.method === 'GET') {
    const found = await prisma.user.findUnique({
      where: { userID: userId },
      include: { permissions: true },
    });
    if (!found) return res.status(404).json({ message: 'User not found' });
    // Always return permissions as a flat object and omit password
    const { password, ...rest } = found;
    const userWithFlatPerms = {
      ...rest,
      permissions: Array.isArray(found.permissions) ? (found.permissions[0] || {}) : (found.permissions || {})
    };
    return res.status(200).json(userWithFlatPerms);
  }

  if (req.method === 'PATCH') {
    // Get current data for audit log
    const currentData = await prisma.user.findUnique({
      where: { userID: userId },
      include: { permissions: true },
    });
    
    const { username, email, role, permissions, password } = req.body;
    const data: any = {};
    if (username) data.username = username;
    if (email) data.email = email;
    if (role) data.role = role;
    if (password) data.password = await hashPassword(password);
    if (permissions) {
      // Only pick the allowed fields for the Permission model
      const {
        viewOnly,
        createProcedureLog,
        editProcedureLog,
        editSettings,
        manageUsers,
        timestamp
      } = permissions;
      await prisma.permission.updateMany({
        where: { userID: userId },
        data: {
          viewOnly,
          createProcedureLog,
          editProcedureLog,
          editSettings,
          manageUsers,
          timestamp
        }
      });
    }
    const updated = await prisma.user.update({
      where: { userID: userId },
      data,
      include: { permissions: true },
    });
    
    // Log audit event
    const adminUserId = parseInt(String(user.id || user.userID));
    if (adminUserId) {
      await logAuditEvent({
        actionType: 'UPDATE',
        userID: adminUserId,
        affectedTable: 'User',
        affectedRowID: userId,
        dataBefore: currentData ? { ...currentData, password: '[HIDDEN]' } : null,
        dataAfter: { ...updated, password: '[HIDDEN]' },
      });
    }
    
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    // Get current data for audit log
    const currentData = await prisma.user.findUnique({
      where: { userID: userId },
      include: { permissions: true },
    });
    
    await prisma.permission.deleteMany({ where: { userID: userId } });
    await prisma.user.delete({ where: { userID: userId } });
    
    // Log audit event
    const adminUserId = parseInt(String(user.id || user.userID));
    if (adminUserId) {
      await logAuditEvent({
        actionType: 'DELETE',
        userID: adminUserId,
        affectedTable: 'User',
        affectedRowID: userId,
        dataBefore: currentData ? { ...currentData, password: '[HIDDEN]' } : null,
      });
    }
    
    return res.status(204).end();
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 