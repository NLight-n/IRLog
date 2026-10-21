import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAContextType {
  isInstallable: boolean;
  isOffline: boolean;
  isServerOffline: boolean;
  setIsServerOffline: (val: boolean) => void;
  lastSynced: string | null;
  setLastSynced: (val: string) => void;
  isStandalone: boolean;
  isIOS: boolean;
  swUpdateAvailable: boolean;
  promptInstall: () => Promise<void>;
  showIOSInstallGuide: boolean;
  setShowIOSInstallGuide: (show: boolean) => void;
  applySWUpdate: () => void;
  checkServerConnection: () => Promise<boolean>;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isOffline: false,
  isServerOffline: false,
  setIsServerOffline: () => {},
  lastSynced: null,
  setLastSynced: () => {},
  isStandalone: false,
  isIOS: false,
  swUpdateAvailable: false,
  promptInstall: async () => {},
  showIOSInstallGuide: false,
  setShowIOSInstallGuide: () => {},
  applySWUpdate: () => {},
  checkServerConnection: async () => false,
});

export const usePWA = () => useContext(PWAContext);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [lastSynced, setLastSyncedState] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstallGuide, setShowIOSInstallGuide] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  const setLastSynced = useCallback((timeStr: string) => {
    setLastSyncedState(timeStr);
    try {
      localStorage.setItem('irlog_last_synced', timeStr);
    } catch {}
  }, []);

  const checkServerConnection = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!navigator.onLine) {
      setIsOffline(true);
      return false;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/settings?_t=' + Date.now(), {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      const isOfflineHeader = res.headers.get('X-IRLog-Offline') === 'true';
      if (res.ok && !isOfflineHeader) {
        setIsServerOffline(false);
        setIsOffline(false);
        const now = new Date().toISOString();
        setLastSynced(now);
        return true;
      } else {
        setIsServerOffline(true);
        return false;
      }
    } catch {
      setIsServerOffline(true);
      return false;
    }
  }, [setLastSynced]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load initial sync timestamp from localStorage
    try {
      const savedSync = localStorage.getItem('irlog_last_synced');
      if (savedSync) setLastSyncedState(savedSync);
    } catch {}

    // Detect offline/online state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      checkServerConnection();
    };
    const handleOffline = () => {
      setIsOffline(true);
      setIsServerOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Custom event listener for when an API returns offline data
    const handleOfflineDataEvent = () => {
      setIsServerOffline(true);
    };
    const handleOnlineDataEvent = () => {
      setIsServerOffline(false);
      setLastSynced(new Date().toISOString());
    };

    window.addEventListener('irlog:server-offline', handleOfflineDataEvent);
    window.addEventListener('irlog:server-online', handleOnlineDataEvent);

    // Initial check
    if (navigator.onLine) {
      checkServerConnection();
    }

    // Detect if running standalone mode (installed PWA / TWA)
    const checkStandalone = () => {
      const isStandaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://');
      setIsStandalone(!!isStandaloneMatch);
    };
    checkStandalone();

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('irlog:server-offline', handleOfflineDataEvent);
      window.removeEventListener('irlog:server-online', handleOnlineDataEvent);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [checkServerConnection, setLastSynced]);

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } else if (isIOS && !isStandalone) {
      setShowIOSInstallGuide(true);
    }
  };

  const applySWUpdate = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isInstallable: isInstallable || (isIOS && !isStandalone),
        isOffline,
        isServerOffline,
        setIsServerOffline,
        lastSynced,
        setLastSynced,
        isStandalone,
        isIOS,
        swUpdateAvailable,
        promptInstall,
        showIOSInstallGuide,
        setShowIOSInstallGuide,
        applySWUpdate,
        checkServerConnection,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};
