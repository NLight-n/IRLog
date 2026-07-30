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
}): Promise<{ total: number; sent: number; failed: number; errors: string[] }> {
  try {
    // Ensure VAPID details are set for this invocation
    const pub = vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const priv = vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || '';
    if (pub && priv) {
      webpush.setVapidDetails(
        'mailto:admin@claritymdt.snhrc.org',
        pub,
        priv
      );
    }

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

    if (subscriptions.length === 0) {
      console.log('No push subscriptions found matching criteria:', whereClause);
      return { total: 0, sent: 0, failed: 0, errors: ['No active push subscriptions found in database.'] };
    }

    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      url: params.url || '/',
      timestamp: Date.now(),
    });

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const parsedKeys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys;
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: parsedKeys,
        };
        await webpush.sendNotification(pushSubscription, payload);
        sentCount++;
      } catch (err: any) {
        failedCount++;
        const statusCode = err.statusCode || err.status;
        const errMsg = `[HTTP ${statusCode || 'ERR'}]: ${err.body || err.message || JSON.stringify(err)}`;
        errors.push(errMsg);
        console.error(`WebPush failure for endpoint ${sub.endpoint.substring(0, 40)}...`, errMsg);

        // If subscription is invalid/expired (4xx) or contains an invalid domain / ENOTFOUND network error, prune it from DB
        const isInvalidEndpoint = sub.endpoint.includes('permanently-removed.invalid') || err.code === 'ENOTFOUND';
        if ((statusCode && statusCode >= 400 && statusCode < 500) || isInvalidEndpoint) {
          console.log(`Pruning invalid/unreachable push subscription endpoint: ${sub.endpoint}`);
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
        }
      }
    });

    await Promise.all(sendPromises);
    return { total: subscriptions.length, sent: sentCount, failed: failedCount, errors };
  } catch (err: any) {
    console.error('Error in sendPushNotification helper:', err);
    return { total: 0, sent: 0, failed: 0, errors: [err.message || String(err)] };
  }
}

