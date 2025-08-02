import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getToken } from 'next-auth/jwt';
import { logAuditEvent } from '../../../lib/auditLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  const sess: any = session;
  if (!sess.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = sess.user;
  const procedureID = parseInt(req.query.id as string);
  if (isNaN(procedureID)) return res.status(400).json({ message: 'Invalid procedure ID' });

  if (req.method === 'GET') {
    const found = await prisma.procedureLog.findUnique({
      where: { procedureID },
      include: {
        doneBy: true,
        refPhysicianObj: true,
        createdBy: true,
        updatedBy: true,
      },
    });
    if (!found) return res.status(404).json({ message: 'Not found' });
    const result = {
      ...found,
      createdByObj: found.createdBy ? { name: found.createdBy.username } : null,
      updatedByObj: found.updatedBy ? { name: found.updatedBy.username } : null,
    };
    delete (result as any).createdBy;
    delete (result as any).updatedBy;
    return res.status(200).json(result);
  }

  if (req.method === 'PATCH' || req.method === 'DELETE') {
    // Use JWT token to get user info and permissions
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const userId = parseInt(String(token.id || token.userID));
    if (!userId) return res.status(401).json({ message: 'Invalid user ID' });
    // Always fetch latest permissions from DB
    const dbPerms = await prisma.permission.findFirst({ where: { userID: userId } });
    if (!dbPerms) return res.status(403).json({ message: 'No permissions found' });
    if (req.method === 'PATCH' && !dbPerms.editProcedureLog) return res.status(403).json({ message: 'Forbidden' });
    if (req.method === 'DELETE' && !dbPerms.editProcedureLog) return res.status(403).json({ message: 'Forbidden' });

    if (req.method === 'PATCH') {
      // Get current data for audit log
      const currentData = await prisma.procedureLog.findUnique({
        where: { procedureID },
        include: {
          doneBy: { include: { physician: true } },
          refPhysicianObj: true,
        },
      });

      const data = req.body;

      // Debug log: print incoming data before update
      console.log('PATCH /api/procedures/[id] incoming data:', data);

      // Remove fields that shouldn't be updated directly
      delete data.procedureID;
      delete data.patientStatus;
      // do NOT delete data.modality; it is a valid field now
      delete data.createdAt;
      delete data.updatedAt;
      delete data.createdById;
      delete data.updatedById;
      delete data.procedure;
      delete data.refPhysicianObj;
      delete data.procedureRef;

      // Convert types
      if (typeof data.patientAge === 'string') data.patientAge = parseInt(data.patientAge) || null;
      if (typeof data.procedureCost === 'string') data.procedureCost = parseFloat(data.procedureCost) || null;
      if (typeof data.refPhysician === 'string') data.refPhysician = parseInt(data.refPhysician) || null;

      // Combine date and time into ISO string for procedureDate
      if (data.procedureDate) {
        let datePart = data.procedureDate;
        if (typeof datePart === 'string' && datePart.length > 10) {
          datePart = datePart.slice(0, 10);
        }
        if (data.procedureTime && /^\d{4}-\d{2}-\d{2}$/.test(datePart) && /^\d{2}:\d{2}$/.test(data.procedureTime)) {
          data.procedureDate = new Date(`${datePart}T${data.procedureTime}:00`).toISOString();
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          // If only date is provided, save as midnight UTC
          data.procedureDate = new Date(`${datePart}T00:00:00.000Z`).toISOString();
        }
      }

      // Handle doneBy: set to new list of physicians
      let doneByUpdate = undefined;
      if (Array.isArray(data.doneBy)) {
        doneByUpdate = {
          deleteMany: {},
          create: data.doneBy.map((physicianID: number) => ({ physicianID })),
        };
      }
      delete data.doneBy;

      // Remove relation objects that should not be updated directly
      delete data.createdBy;
      delete data.createdByObj;
      delete data.updatedBy;
      delete data.updatedByObj;

      const refPhysicianId = data.refPhysician;
      delete data.refPhysician;

      const updated = await prisma.procedureLog.update({
        where: { procedureID },
        data: {
          ...data,
          ...(refPhysicianId ? { refPhysicianObj: { connect: { physicianID: refPhysicianId } } } : {}),
          ...(doneByUpdate ? { doneBy: doneByUpdate } : {}),
          updatedBy: { connect: { userID: userId } },
        },
        include: {
          doneBy: { include: { physician: true } },
          refPhysicianObj: true,
        },
      });

      // Log audit event
      await logAuditEvent({
        actionType: 'UPDATE',
        userID: userId,
        affectedTable: 'ProcedureLog',
        affectedRowID: procedureID,
        dataBefore: currentData,
        dataAfter: updated,
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      // Get current data for audit log
      const currentData = await prisma.procedureLog.findUnique({
        where: { procedureID },
        include: {
          doneBy: { include: { physician: true } },
          refPhysicianObj: true,
        },
      });

      // First delete all related ProcedurePhysicians
      await prisma.procedurePhysicians.deleteMany({ where: { procedureID } });
      await prisma.procedureLog.delete({ where: { procedureID } });

      // Log audit event
      await logAuditEvent({
        actionType: 'DELETE',
        userID: userId,
        affectedTable: 'ProcedureLog',
        affectedRowID: procedureID,
        dataBefore: currentData,
      });

      return res.status(204).end();
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 