import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';

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
          },
        });
      }
      return res.status(200).json(settings);
    }
    if (req.method === 'PATCH') {
      const { appHeading, appSubheading, currency, dateFormat, timeFormat } = req.body;
      const updateData: any = {};
      if (appHeading !== undefined) updateData.appHeading = appHeading;
      if (appSubheading !== undefined) updateData.appSubheading = appSubheading;
      if (currency !== undefined) updateData.currency = currency;
      if (dateFormat !== undefined) updateData.dateFormat = dateFormat;
      if (timeFormat !== undefined) updateData.timeFormat = timeFormat;
      const updated = await prisma.systemSettings.update({
        where: { id: 1 },
        data: updateData,
      });
      return res.status(200).json(updated);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('SystemSettings API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 