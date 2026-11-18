import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { prisma } from '../../../lib/prisma/prisma';
import { logAuditEvent } from '../../../lib/auditLogger';
import { sendPushNotification } from '../../../lib/pushNotification';
import { DEFAULT_REQUISITION_ORDERS } from '../settings/index';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const userId = parseInt(String(token.id || token.userID), 10);

  if (req.method === 'GET') {
    try {
      const { category, status } = req.query;
      let whereClause: any = {};

      if (status && typeof status === 'string') {
        whereClause.status = status;
      } else if (category === 'active') {
        whereClause.status = { in: ['Submitted', 'Accepted'] };
      } else if (category === 'inactive') {
        whereClause.status = { in: ['Done', 'Cancelled', 'NotDone'] };
      }

      const requests = await prisma.procedureRequest.findMany({
        where: whereClause,
        include: {
          workItem: true,
          createdBy: { select: { userID: true, username: true, role: true } },
        },
        orderBy: [
          { status: 'asc' }, // 'Accepted' before 'Submitted' or vice-versa
          { createdAt: 'desc' },
        ],
      });

      return res.status(200).json(requests);
    } catch (err: any) {
      console.error('Error fetching procedure requests:', err);
      return res.status(500).json({ message: 'Failed to fetch procedure requests' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const {
        patientName,
        patientAge,
        patientSex,
        hospitalID,
        patientType = 'IP',
        ward,
        procedure,
        otherProcedure,
        fromWhere,
        samplesAnalysis = [],
        otherSamples,
        requesterDesignation,
        requesterName,
        requesterContact,
        urgency = 'Routine',
        clinicalNotes,
        referringConsultant,
        modality,
      } = body;

      if (!patientName || !hospitalID || !procedure || !fromWhere) {
        return res.status(400).json({
          message: 'Missing required fields (patientName, hospitalID, procedure, and fromWhere are required)',
        });
      }

      // Look up generic pre-procedure orders from system settings or defaults
      let genericOrders: string[] = [];
      try {
        const sysSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
        const ordersMap = (sysSettings?.requisitionOrders as Record<string, string[]>) || DEFAULT_REQUISITION_ORDERS;
        const matchedOrders = ordersMap[procedure] || (procedure === 'Others' ? ordersMap['Others'] : null) || DEFAULT_REQUISITION_ORDERS[procedure] || DEFAULT_REQUISITION_ORDERS['Others'];
        if (Array.isArray(matchedOrders)) {
          genericOrders = matchedOrders;
        }
      } catch (e) {
        genericOrders = DEFAULT_REQUISITION_ORDERS[procedure] || DEFAULT_REQUISITION_ORDERS['Others'] || [];
      }

      const created = await prisma.procedureRequest.create({
        data: {
          patientName,
          patientAge: patientAge ? parseInt(String(patientAge), 10) : null,
          patientSex: patientSex || null,
          hospitalID,
          patientType: patientType || 'IP',
          ward: patientType === 'IP' ? (ward || null) : null,
          procedure,
          otherProcedure: otherProcedure || null,
          fromWhere,
          samplesAnalysis: Array.isArray(samplesAnalysis) ? samplesAnalysis : [],
          otherSamples: otherSamples || null,
          genericOrders: genericOrders.length > 0 ? (genericOrders as any) : undefined,
          requesterDesignation: requesterDesignation || null,
          requesterName: requesterName || null,
          requesterContact: requesterContact || null,
          urgency: urgency || 'Routine',
          clinicalNotes: clinicalNotes || null,
          referringConsultant: referringConsultant || null,
          modality: modality || null,
          status: 'Submitted',
          createdById: userId || null,
        },
        include: {
          workItem: true,
          createdBy: { select: { userID: true, username: true, role: true } },
        },
      });

      if (userId) {
        await logAuditEvent({
          actionType: 'CREATE',
          userID: userId,
          affectedTable: 'ProcedureRequest',
          affectedRowID: created.id,
          dataAfter: created,
        });
      }

      // Send push notification to IRs
      const requesterTitle = created.requesterDesignation || 'Staff';
      const reqPerson = created.requesterName ? ` by ${created.requesterName} (${requesterTitle})` : ` by ${requesterTitle}`;
      const procDisplay = created.procedure === 'Others' && created.otherProcedure ? created.otherProcedure : created.procedure;

      sendPushNotification({
        title: '📋 New IR Procedure Request',
        body: `${created.patientName} (${created.hospitalID}): ${procDisplay} for ${created.fromWhere}${reqPerson}`,
        url: '/worklist',
      }).catch(err => console.error('Failed to send push notification:', err));

      return res.status(201).json(created);
    } catch (err: any) {
      console.error('Error creating procedure request:', err);
      return res.status(500).json({ message: 'Failed to create procedure request' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
