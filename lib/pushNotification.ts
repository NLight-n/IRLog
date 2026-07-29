import webpush from 'web-push';
import { prisma } from './prisma/prisma';

// Attempt to get VAPID keys from environment variables
let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

// Fallback: Generate keys dynamically if not configured in .env
if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    if (!vapidPublicKey) vapidPublicKey = generated.publicKey;
    if (!vapidPrivateKey) vapidPrivateKey = generated.privateKey;
    
    console.warn('=== WARNING: VAPID keys not configured in .env ===');
    console.warn('Generated temporary VAPID keys for this session:');
    console.warn(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidPublicKey}"`);
    console.warn(`VAPID_PRIVATE_KEY="${vapidPrivateKey}"`);
    console.warn('Please add these keys to your .env file to persist push subscriptions across server restarts.');
    console.warn('==================================================');
  } catch (err) {
    console.error('Failed to generate VAPID keys:', err);
  }
}

// Configure web-push details
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@claritymdt.snhrc.org',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export { vapidPublicKey };

/**
 * Send a web push notification to a user's active device subscriptions
 * @param userID Target user ID (or undefined to send to everyone except a specific user)
 * @param title Notification title
 * @param body Notification body text
 * @param url Redirect URL when clicked
 * @param excludeUserID Optional user ID to exclude (so the editor doesn't get their own push alert)
 */
export async function sendPushNotification(params: {
  userID?: number;
  title: string;
  body: string;
  url?: string;
  excludeUserID?: number;
}) {
  try {
    // Find matching subscriptions
    const whereClause: any = {};
    if (params.userID !== undefined) {
      whereClause.userID = params.userID;
    }
    if (params.excludeUserID !== undefined) {
      whereClause.userID = {
        ...whereClause.userID,
        not: params.excludeUserID,
      };
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: whereClause,
    });

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      url: params.url || '/',
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys as any,
        };
        await webpush.sendNotification(pushSubscription, payload);
      } catch (err: any) {
        // If subscription has expired or is invalid (404 or 410 Gone), remove it from the DB
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Pruning expired push subscription endpoint: ${sub.endpoint}`);
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
        } else {
          console.error(`Error sending Web Push to endpoint ${sub.endpoint}:`, err);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('Error in sendPushNotification helper:', err);
  }
}
