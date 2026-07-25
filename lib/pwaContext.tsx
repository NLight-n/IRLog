import React, { createContext, useContext, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAContextType {
  isInstallable: boolean;
  isOffline: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  swUpdateAvailable: boolean;
  promptInstall: () => Promise<void>;
  showIOSInstallGuide: boolean;
  setShowIOSInstallGuide: (show: boolean) => void;
  applySWUpdate: () => void;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isOffline: false,
  isStandalone: false,
  isIOS: false,
  swUpdateAvailable: false,
  promptInstall: async () => {},
  showIOSInstallGuide: false,
  setShowIOSInstallGuide: () => {},
  applySWUpdate: () => {},
});

export const usePWA = () => useContext(PWAContext);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstallGuide, setShowIOSInstallGuide] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect offline/online state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detect if running standalone mode (installed PWA)
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

    // Check when appinstalled event triggers
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
      console.log('IRLog PWA was installed');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

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
        isStandalone,
        isIOS,
        swUpdateAvailable,
        promptInstall,
        showIOSInstallGuide,
        setShowIOSInstallGuide,
        applySWUpdate,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};
