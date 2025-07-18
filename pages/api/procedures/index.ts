import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  console.log('TOKEN:', token);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const user = token;

  if (req.method === 'GET') {
    // All authenticated users can view
    const procedures = await prisma.procedureLog.findMany({
      include: {
        doneBy: { include: { physician: true } },
        refPhysicianObj: true,
        createdBy: { select: { username: true } },
      },
      orderBy: { procedureDate: 'desc' },
    });
    return res.status(200).json(procedures);
  }

  if (req.method === 'GET' && req.query.list === 'true') {
    // Return unique procedure names from Procedure table
    const procedures = await prisma.procedure.findMany({
      select: { procedureName: true },
    });
    // Get unique procedure names
    const procedureNames = Array.from(new Set(procedures.map((p: any) => p.procedureName)));
    return res.status(200).json({ procedureNames });
  }

  if (req.method === 'GET' && req.query['list-all'] === 'true') {
    // Return all procedures for dropdown selection
    const allProcedures = await prisma.procedure.findMany({ select: { procedureName: true, proID: true } });
    return res.status(200).json(allProcedures);
  }

  if (req.method === 'POST') {
    const perms = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
    if (!perms?.createProcedureLog) return res.status(403).json({ message: 'Forbidden' });
    const userId = parseInt(String(user.id || user.userID));
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    const data = req.body;
    delete data.procedureID;
    delete data.patientStatus;
    // do NOT delete data.modality; it is a valid field now
    delete data.procedureRef;
    // Convert types as needed
    if (typeof data.patientAge === 'string') data.patientAge = parseInt(data.patientAge) || null;
    if (typeof data.procedureCost === 'string') data.procedureCost = parseFloat(data.procedureCost) || null;
    // Combine date and time into ISO string for procedureDate
    if (data.procedureDate && data.procedureTime) {
      data.procedureDate = new Date(`${data.procedureDate}T${data.procedureTime}:00`).toISOString();
    }
    // Convert doneBy array to nested create format for Prisma
    if (Array.isArray(data.doneBy)) {
      data.doneBy = {
        create: data.doneBy.map((physicianID: number) => ({ physicianID }))
      };
    }
    if (typeof data.refPhysician === 'string') data.refPhysician = parseInt(data.refPhysician) || null;
    const created = await prisma.procedureLog.create({
      data: {
        ...data,
        createdById: userId,
      },
    });
    
    // Log audit event
    await logAuditEvent({
      actionType: 'CREATE',
      userID: userId,
      affectedTable: 'ProcedureLog',
      affectedRowID: created.procedureID,
      dataAfter: created,
    });
    
    return res.status(201).json(created);
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 