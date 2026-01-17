import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const user = token;
  
  // Handle permissions array/object flattening like in other parts of the app
  const perms = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
  
  // Check for any permission that would allow viewing audit logs
  // Users with viewOnly, editSettings, or admin permissions should be able to view audit logs
  const hasPermission = perms?.viewOnly || perms?.editSettings || perms?.admin || perms?.superAdmin;
  
  if (!hasPermission) {
    console.log('Audit Log API - Permission denied. Available permissions:', perms);
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.method === 'GET') {
    const { 
      actionType, 
      affectedTable, 
      userID, 
      dateFrom, 
      dateTo,
      page = '1',
      limit = '50'
    } = req.query;
    
    const where: any = {};
    
    if (actionType) where.actionType = actionType;
    if (affectedTable) where.affectedTable = affectedTable;
    if (userID) where.userID = parseInt(userID as string);
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom as string);
      if (dateTo) where.timestamp.lte = new Date(dateTo as string);
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              userID: true,
              username: true,
              email: true,
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);
    
    return res.status(200).json({
      logs,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  }
  return res.status(405).json({ message: 'Method not allowed' });
} 