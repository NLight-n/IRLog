import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getServerSession } from 'next-auth/next';
import authOptions from '../auth/[...nextauth]';
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
        procedure: true,
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
    delete result.createdBy;
    delete result.updatedBy;
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
          procedure: true,
          doneBy: { include: { physician: true } },
          refPhysicianObj: true,
        },
      });

      const data = req.body;

      // Remove fields that shouldn't be updated directly
      delete data.procedureID;
      delete data.patientStatus;
      delete data.modality;
      delete data.createdAt;
      delete data.updatedAt;
      delete data.createdById;
      delete data.updatedById;
      delete data.procedure;
      delete data.refPhysicianObj;
      // procedureRef is allowed, but must be a number

      // Convert types
      if (typeof data.patientAge === 'string') data.patientAge = parseInt(data.patientAge) || null;
      if (typeof data.procedureRef === 'string') data.procedureRef = parseInt(data.procedureRef) || null;
      if (typeof data.procedureCost === 'string') data.procedureCost = parseFloat(data.procedureCost) || null;
      if (typeof data.refPhysician === 'string') data.refPhysician = parseInt(data.refPhysician) || null;

      // Combine date and time into ISO string for procedureDate
      if (data.procedureDate && data.procedureTime) {
        // If procedureDate is already an ISO string, extract date part
        let datePart = data.procedureDate;
        if (typeof datePart === 'string' && datePart.length > 10) {
          datePart = datePart.slice(0, 10);
        }
        // Only combine if both are valid
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && /^\d{2}:\d{2}$/.test(data.procedureTime)) {
          data.procedureDate = new Date(`${datePart}T${data.procedureTime}:00`).toISOString();
        }
      }

      // Handle doneBy: set to new list of physicians
      let doneByUpdate = undefined;
      if (Array.isArray(data.doneBy)) {
        doneByUpdate = {
          deleteMany: {}, // remove all existing
          create: data.doneBy.map((physicianID: number) => ({ physicianID })),
        };
      }
      delete data.doneBy;

      // Map procedureRef and refPhysician to relation updates
      const { procedureRef, refPhysician, ...rest } = data;

      // Remove relation objects that should not be updated directly
      delete rest.createdBy;
      delete rest.createdByObj;
      delete rest.updatedBy;
      delete rest.updatedByObj;

      const updated = await prisma.procedureLog.update({
        where: { procedureID },
        data: {
          ...rest,
          ...(procedureRef ? { procedure: { connect: { proID: procedureRef } } } : {}),
          ...(refPhysician ? { refPhysicianObj: { connect: { physicianID: refPhysician } } } : {}),
          ...(doneByUpdate ? { doneBy: doneByUpdate } : {}),
          updatedBy: { connect: { userID: userId } },
        },
        include: {
          procedure: true,
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
          procedure: true,
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