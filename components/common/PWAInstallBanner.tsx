import React from 'react';
import { usePWA } from '../../lib/pwaContext';
import { FiDownload, FiShare, FiPlusSquare, FiX, FiRefreshCw } from 'react-icons/fi';

export const PWAInstallBanner: React.FC = () => {
  const {
    showIOSInstallGuide,
    setShowIOSInstallGuide,
    swUpdateAvailable,
    applySWUpdate,
  } = usePWA();

  return (
    <>
      {/* iOS Installation Modal Guide */}
      {showIOSInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-700 relative">
            <button
              onClick={() => setShowIOSInstallGuide(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg"
            >
              <FiX size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <FiDownload size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Install IRLog on iOS</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Add to your Home Screen for full app experience</p>
              </div>
            </div>

            <ol className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300 my-5">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white font-semibold flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                <div>
                  Tap the <strong className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><FiShare size={16} /> Share</strong> button in Safari's bottom navigation bar.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white font-semibold flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                <div>
                  Scroll down the menu and tap <strong className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><FiPlusSquare size={16} /> Add to Home Screen</strong>.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white font-semibold flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                <div>
                  Tap <strong>Add</strong> in the top right corner to launch IRLog like a native app.
                </div>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSInstallGuide(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-md text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* SW Update Notification */}
      {swUpdateAvailable && (
        <div className="fixed bottom-20 right-4 z-50 bg-zinc-900 text-white p-4 rounded-xl shadow-2xl border border-zinc-700 max-w-sm flex items-center justify-between gap-4 animate-bounce-short">
          <div className="flex items-center gap-3">
            <FiRefreshCw className="text-blue-400 text-xl animate-spin" />
            <div className="text-xs">
              <p className="font-semibold text-sm">New version available</p>
              <p className="text-zinc-400">Update now to get the latest features.</p>
            </div>
          </div>
          <button
            onClick={applySWUpdate}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors"
          >
            Update
          </button>
        </div>
      )}
    </>
  );
};

export default PWAInstallBanner;
