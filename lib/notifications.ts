// Web Push Notifications Client Helper

// Utility to convert VAPID public key string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request notification permission from the browser.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

/**
 * Registers Web Push subscription for the active user session.
 */
export async function subscribeUserToPush(): Promise<{ ok: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, message: 'Service workers are not supported by this browser.' };
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return { ok: false, message: 'Notification permission was denied.' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key from env variable
    const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      throw new Error('VAPID public key is not configured on the server.');
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    });

    // Send subscription object to Next.js API route
    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Server rejected registration.');
    }

    return { ok: true, message: 'Web Push subscription registered successfully!' };
  } catch (err: any) {
    console.error('Error during Web Push registration:', err);
    return { ok: false, message: err.message || 'Web Push registration failed.' };
  }
}

/**
 * Unsubscribes the current device/browser from push notifications.
 */
export async function unsubscribeUserFromPush(): Promise<{ ok: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, message: 'Service workers not supported.' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // 1. Tell server to delete from DB
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      // 2. Unsubscribe locally
      await subscription.unsubscribe();
    }

    return { ok: true, message: 'Device unsubscribed from notifications successfully.' };
  } catch (err: any) {
    console.error('Error unsubscribing from Web Push:', err);
    return { ok: false, message: err.message || 'Failed to unsubscribe.' };
  }
}

/**
 * Check if the current browser/device is active on push notifications.
 */
export async function checkPushSubscriptionStatus(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
