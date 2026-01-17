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
      // Return settings with hasLogo flag instead of binary data
      const response = {
        ...settings,
        appLogoData: undefined, // Don't send binary in JSON response
        hasLogo: !!(settings.appLogoData && settings.appLogoMimeType),
      };
      return res.status(200).json(response);
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
      // Return with hasLogo flag
      const response = {
        ...updated,
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
