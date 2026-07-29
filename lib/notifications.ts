// Daily Procedure Reminders Notification Helper

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

export async function checkAndSendDailySummary(force: boolean = false): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const lastNotifDate = localStorage.getItem('irlog_last_daily_notif_date');

  // Only trigger once per day unless forced
  if (!force && lastNotifDate === todayStr) {
    return;
  }

  try {
    const res = await fetch('/api/worklist');
    if (!res.ok) return;
    const items: any[] = await res.json();

    // Filter today's scheduled procedures
    const todayItems = items.filter((item: any) => {
      if (!item.dateScheduled) return false;
      const dateKey = new Date(item.dateScheduled).toISOString().slice(0, 10);
      return dateKey === todayStr && item.status !== 'Cancelled';
    });

    const count = todayItems.length;
    let bodyText = `You have ${count} procedure(s) scheduled for today (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}).`;

    if (count > 0) {
      const topProcedures = todayItems
        .slice(0, 3)
        .map((it: any) => `• ${it.patientName}: ${it.procedureName} (${it.modality || 'IR'})`)
        .join('\n');
      bodyText += `\n${topProcedures}`;
      if (count > 3) bodyText += `\n...and ${count - 3} more.`;
    }

    // Trigger Notification
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification('📋 IRLog Today\'s Schedule', {
          body: bodyText,
          icon: '/favicon.png',
          badge: '/favicon.png',
          data: { url: '/worklist' },
        });
      });
    } else {
      new Notification('📋 IRLog Today\'s Schedule', {
        body: bodyText,
        icon: '/favicon.png',
      });
    }

    localStorage.setItem('irlog_last_daily_notif_date', todayStr);
  } catch (err) {
    console.error('Error triggering daily procedure notification:', err);
  }
}
