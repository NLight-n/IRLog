import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { getToken } from 'next-auth/jwt';

export const DEFAULT_REQUISITION_PROCEDURES = [
  'Biopsy',
  'Pigtail',
  'Aspiration-diagnostic',
  'Aspiration-therapeutic',
  'Others',
];

export const DEFAULT_REQUISITION_SAMPLES = [
  'Routine fluid analysis',
  'Culture & Sensitivity',
  'GeneXpert',
  'No analysis needed',
  'Small biopsy (HPE)',
];

export const DEFAULT_REQUISITION_WARDS = [
  'Ward 4B',
  'Ward 3A',
  'Ward 2C',
  'ICU',
  'CCU',
  'MICU',
  'SICU',
  'Casualty / ER',
  'Day Care',
  'Private Ward',
  'Semi-Private',
  'General Ward',
];

export const DEFAULT_REQUISITION_DESIGNATIONS = [
  'Staff Nurse',
  'DMO',
  'CMO',
  'Consultant',
  'Resident',
  'Fellow',
  'Physician Assistant',
];

export const DEFAULT_REQUISITION_ORDERS: Record<string, string[]> = {
  Biopsy: [
    'Make sure CBC, PT/INR and Serology investigations are available and done recently.',
    'Part preparation as needed to reach the target lesion.',
    'NPO status to be discussed with the IR PA.',
    'Ensure informed written consent for Image-guided Biopsy is documented.',
    'Check for anticoagulant or antiplatelet medication status.',
  ],
  Pigtail: [
    'Ensure recent coagulation profile (PT/INR, Platelet count) and renal function tests are available.',
    'Part preparation of insertion site with wide sterile drape area.',
    'NPO for at least 4 hours prior to procedure (except emergency drainages).',
    'Keep sterile drainage bag and connector ready at bedside.',
  ],
  'Aspiration-diagnostic': [
    'Ensure appropriate sterile collection bulbs/syringes and viral transport/EDTA/sterile containers are available.',
    'Verify coagulation parameters if deep-seated or vascular-adjacent lesion.',
    'Arrange immediate transport to laboratory for routine analysis, culture & sensitivity, or GeneXpert.',
  ],
  'Aspiration-therapeutic': [
    'Verify recent coagulation profile and vitals stability.',
    'Part preparation as per puncture site.',
    'Keep collection bottles, 3-way stopcock, and evacuation containers ready.',
    'Post-procedure vitals monitoring every 15 minutes for the first hour.',
  ],
  Others: [
    'Verify pre-procedure baseline vitals and recent lab investigations (CBC, Coagulation).',
    'Confirm NPO status with IR team.',
    'Ensure active IV access and informed written consent.',
  ],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Always use the single row with id=1
    if (req.method === 'GET') {
      let settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
      if (!settings) {
        settings = await prisma.systemSettings.create({
          data: {
            id: 1,
            appHeading: 'Interventional Radiology',
            appSubheading: '',
            currency: '$',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24hr',
            requisitionProcedures: DEFAULT_REQUISITION_PROCEDURES,
            requisitionSamples: DEFAULT_REQUISITION_SAMPLES,
            requisitionOrders: DEFAULT_REQUISITION_ORDERS,
            requisitionWards: DEFAULT_REQUISITION_WARDS,
            requisitionDesignations: DEFAULT_REQUISITION_DESIGNATIONS,
          },
        });
      }
      // Return settings with hasLogo flag instead of binary data
      const response = {
        ...settings,
        requisitionProcedures: settings.requisitionProcedures || DEFAULT_REQUISITION_PROCEDURES,
        requisitionSamples: settings.requisitionSamples || DEFAULT_REQUISITION_SAMPLES,
        requisitionOrders: settings.requisitionOrders || DEFAULT_REQUISITION_ORDERS,
        requisitionWards: settings.requisitionWards || DEFAULT_REQUISITION_WARDS,
        requisitionDesignations: settings.requisitionDesignations || DEFAULT_REQUISITION_DESIGNATIONS,
        appLogoData: undefined, // Don't send binary in JSON response
        hasLogo: !!(settings.appLogoData && settings.appLogoMimeType),
      };
      return res.status(200).json(response);
    }
    if (req.method === 'PATCH') {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      const perms = (token as any)?.permissions || {};
      if (!perms.editSettings && !perms.manageUsers) {
        return res.status(403).json({ message: 'Forbidden: Requires editSettings permission' });
      }

      const {
        appHeading,
        appSubheading,
        currency,
        dateFormat,
        timeFormat,
        weeklyHoliday,
        requisitionProcedures,
        requisitionSamples,
        requisitionOrders,
        requisitionWards,
        requisitionDesignations,
      } = req.body;

      const updateData: any = {};
      if (appHeading !== undefined) updateData.appHeading = appHeading;
      if (appSubheading !== undefined) updateData.appSubheading = appSubheading;
      if (currency !== undefined) updateData.currency = currency;
      if (dateFormat !== undefined) updateData.dateFormat = dateFormat;
      if (timeFormat !== undefined) updateData.timeFormat = timeFormat;
      if (weeklyHoliday !== undefined) updateData.weeklyHoliday = weeklyHoliday;
      if (requisitionProcedures !== undefined) updateData.requisitionProcedures = requisitionProcedures;
      if (requisitionSamples !== undefined) updateData.requisitionSamples = requisitionSamples;
      if (requisitionOrders !== undefined) updateData.requisitionOrders = requisitionOrders;
      if (requisitionWards !== undefined) updateData.requisitionWards = requisitionWards;
      if (requisitionDesignations !== undefined) updateData.requisitionDesignations = requisitionDesignations;

      const updated = await prisma.systemSettings.update({
        where: { id: 1 },
        data: updateData,
      });
      // Return with hasLogo flag
      const response = {
        ...updated,
        requisitionProcedures: updated.requisitionProcedures || DEFAULT_REQUISITION_PROCEDURES,
        requisitionSamples: updated.requisitionSamples || DEFAULT_REQUISITION_SAMPLES,
        requisitionOrders: updated.requisitionOrders || DEFAULT_REQUISITION_ORDERS,
        requisitionWards: updated.requisitionWards || DEFAULT_REQUISITION_WARDS,
        requisitionDesignations: updated.requisitionDesignations || DEFAULT_REQUISITION_DESIGNATIONS,
        appLogoData: undefined,
        hasLogo: !!(updated.appLogoData && updated.appLogoMimeType),
      };
      return res.status(200).json(response);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('SystemSettings API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
