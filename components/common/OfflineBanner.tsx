import React, { useState, useEffect } from 'react';
import { usePWA } from '../../lib/pwaContext';
import { FiWifiOff, FiCheckCircle, FiX } from 'react-icons/fi';

export const OfflineBanner: React.FC = () => {
  const { isOffline } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setDismissed(false);
      setWasOffline(true);
    } else if (wasOffline) {
      // Just reconnected
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white text-sm py-2 px-4 flex items-center justify-between shadow-md transition-all">
        <div className="flex items-center gap-2 mx-auto">
          <FiCheckCircle className="text-lg animate-bounce" />
          <span className="font-medium">Internet connection restored. You are back online!</span>
        </div>
      </div>
    );
  }

  if (!isOffline || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-sm py-2.5 px-4 flex items-center justify-between shadow-lg border-b border-amber-700 animate-slide-down">
      <div className="flex items-center gap-2.5 mx-auto">
        <FiWifiOff className="text-xl shrink-0" />
        <span className="font-medium">
          You are currently offline. You can still view cached records, but changes require a network connection.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-white hover:text-amber-200 p-1 rounded transition-colors"
        title="Dismiss notice"
      >
        <FiX className="text-lg" />
      </button>
    </div>
  );
};

export default OfflineBanner;
