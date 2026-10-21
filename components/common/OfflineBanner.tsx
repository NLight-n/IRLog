import React, { useState, useEffect } from 'react';
import { usePWA } from '../../lib/pwaContext';
import { FiWifiOff, FiCheckCircle, FiX, FiRefreshCw, FiServer } from 'react-icons/fi';

export const OfflineBanner: React.FC = () => {
  const { isOffline, isServerOffline, lastSynced, checkServerConnection } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isEffectiveOffline = isOffline || isServerOffline;

  useEffect(() => {
    if (isEffectiveOffline) {
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
  }, [isEffectiveOffline, wasOffline]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await checkServerConnection();
    } finally {
      setTimeout(() => setIsRetrying(false), 500);
    }
  };

  const formattedTime = lastSynced ? (() => {
    try {
      const d = new Date(lastSynced);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  })() : '';

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white text-xs sm:text-sm py-2 px-4 flex items-center justify-between shadow-md transition-all">
        <div className="flex items-center gap-2 mx-auto">
          <FiCheckCircle className="text-base sm:text-lg animate-bounce" />
          <span className="font-medium">Connection restored. Live sync active!</span>
        </div>
      </div>
    );
  }

  if (!isEffectiveOffline || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 dark:bg-amber-700 text-white text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center justify-between shadow-lg border-b border-amber-800 transition-all">
      <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
        {isOffline ? (
          <FiWifiOff className="text-base sm:text-lg shrink-0 text-amber-200" />
        ) : (
          <FiServer className="text-base sm:text-lg shrink-0 text-amber-200" />
        )}
        <div className="truncate">
          <span className="font-semibold">
            {isOffline ? 'No Internet: ' : 'Server Offline: '}
          </span>
          <span className="opacity-95">
            Displaying cached records.
            {formattedTime && <span className="ml-1 text-amber-100 font-mono text-[11px]">(Synced {formattedTime})</span>}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-700/80 hover:bg-amber-800 text-white text-xs font-medium transition disabled:opacity-50"
          title="Retry connection to server"
        >
          <FiRefreshCw className={`text-xs ${isRetrying ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Retry</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-white hover:text-amber-200 p-1 rounded transition-colors"
          title="Dismiss notice"
        >
          <FiX className="text-base" />
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
