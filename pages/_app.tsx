import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/global.css';
import { ThemeProvider } from '../lib/theme/ThemeContext';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ColumnContext, defaultColumns } from '../lib/columnContext';
import { AppointmentsCountProvider } from '../lib/appointmentsCountContext';
import { PWAProvider } from '../lib/pwaContext';
import OfflineBanner from '../components/common/OfflineBanner';
import PWAInstallBanner from '../components/common/PWAInstallBanner';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

if (typeof window !== 'undefined' && !(window as any).__fetchOverridden) {
  (window as any).__fetchOverridden = true;
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    let urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (input && typeof input === 'object' && 'url' in input) {
      urlStr = (input as any).url;
    }

    let targetInput: RequestInfo | URL = input;
    if (basePath && urlStr.startsWith('/api/')) {
      const rewritten = basePath + urlStr;
      if (typeof input === 'string') {
        targetInput = rewritten;
      } else if (input instanceof URL) {
        targetInput = new URL(rewritten, window.location.origin);
      } else {
        targetInput = new Request(rewritten, input as Request);
      }
    } else if (basePath && urlStr.startsWith(window.location.origin + '/api/')) {
      const relativePart = urlStr.substring(window.location.origin.length);
      const rewritten = window.location.origin + basePath + relativePart;
      if (typeof input === 'string') {
        targetInput = rewritten;
      } else if (input instanceof URL) {
        targetInput = new URL(rewritten);
      } else {
        targetInput = new Request(rewritten, input as Request);
      }
    }

    try {
      const res = await originalFetch(targetInput, init);
      // Check for Service Worker offline indicator header
      if (res.headers.get('X-IRLog-Offline') === 'true') {
        window.dispatchEvent(new CustomEvent('irlog:server-offline'));
      } else if (res.ok && urlStr.includes('/api/')) {
        window.dispatchEvent(new CustomEvent('irlog:server-online'));
        try {
          localStorage.setItem('irlog_last_synced', Date.now().toString());
        } catch {}
      }

      // Cache session for offline fallback
      if (urlStr.includes('/api/auth/session') && res.ok) {
        res.clone().json().then(data => {
          if (data && data.user) {
            localStorage.setItem('irlog_cached_session', JSON.stringify(data));
          }
        }).catch(() => {});
      } else if (urlStr.includes('/api/auth/signout')) {
        localStorage.removeItem('irlog_cached_session');
      }

      return res;
    } catch (err) {
      if (urlStr.includes('/api/')) {
        window.dispatchEvent(new CustomEvent('irlog:server-offline'));
      }
      throw err;
    }
  };
}

// AppSettingsContext for global heading/subheading/logo
const AppSettingsContext = createContext({
  appHeading: 'Interventional Radiology Register',
  appSubheading: '',
  appLogo: '',
  setAppHeading: (h: string) => { },
  setAppSubheading: (s: string) => { },
  setAppLogo: (l: string) => { },
  refreshSettings: () => { },
});
export const useAppSettings = () => useContext(AppSettingsContext);

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const [columns, setColumns] = useState(defaultColumns);
  const [appHeading, setAppHeading] = useState('Interventional Radiology Register');
  const [appSubheading, setAppSubheading] = useState('');
  const [appLogo, setAppLogo] = useState('');

  // Preload settings from cache, then fetch fresh
  const refreshSettings = () => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.appHeading) setAppHeading(data.appHeading);
        if (data.appSubheading !== undefined) setAppSubheading(data.appSubheading);
        try {
          localStorage.setItem('irlog_cached_settings', JSON.stringify({
            appHeading: data.appHeading,
            appSubheading: data.appSubheading,
            hasLogo: data.hasLogo
          }));
        } catch {}
        if (data.hasLogo) {
          setAppLogo(`${basePath}/api/logo?t=${Date.now()}`);
        } else {
          setAppLogo('');
        }
      })
      .catch(() => {
        // Handled by cached settings in localStorage
      });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('irlog_cached_settings');
        if (cached) {
          const data = JSON.parse(cached);
          if (data.appHeading) setAppHeading(data.appHeading);
          if (data.appSubheading !== undefined) setAppSubheading(data.appSubheading);
          if (data.hasLogo) setAppLogo(`${basePath}/api/logo`);
        }
      } catch {}
    }
    refreshSettings();
  }, []);

  useEffect(() => {
    async function fetchAndMergeColumns() {
      try {
        const res = await fetch('/api/users/profile');
        if (res.ok) {
          const data = await res.json();
          let userCols = Array.isArray(data.columns) ? data.columns : defaultColumns;
          userCols = userCols.filter((uc: any) => defaultColumns.some(dc => dc.key === uc.key));
          const userColKeys = userCols.map((uc: any) => uc.key);
          const mergedCols = [
            ...userCols,
            ...defaultColumns.filter(dc => !userColKeys.includes(dc.key))
          ];
          setColumns(mergedCols);
          try {
            localStorage.setItem('irlog_cached_columns', JSON.stringify(mergedCols));
          } catch {}
        } else {
          loadCachedColumns();
        }
      } catch {
        loadCachedColumns();
      }
    }

    function loadCachedColumns() {
      try {
        const cached = localStorage.getItem('irlog_cached_columns');
        if (cached) {
          setColumns(JSON.parse(cached));
          return;
        }
      } catch {}
      setColumns(defaultColumns);
    }

    fetchAndMergeColumns();
  }, []);

  // Register PWA Service Worker with explicit scope
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const swUrl = `${basePath}/sw.js`;
      const swScope = basePath ? `${basePath}/` : '/';
      navigator.serviceWorker.register(swUrl, { scope: swScope }).catch(err => {
        console.error('PWA ServiceWorker registration failed:', err);
      });
    }
  }, []);

  return (
    <SessionProvider session={session} basePath={`${basePath}/api/auth`}>
      <PWAProvider>
        <Head>
          <title>IRLog</title>
          <link rel="icon" href={`${basePath}/irLogo.svg`} type="image/svg+xml" />
          <link rel="alternate icon" href={`${basePath}/favicon.ico`} />
          <link rel="shortcut icon" href={`${basePath}/irLogo.svg`} />
          <link rel="manifest" href={`${basePath}/api/manifest`} />
          <link rel="apple-touch-icon" href={`${basePath}/icons/apple-touch-icon.png`} />
          <meta name="theme-color" content="#18181b" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="IRLog" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        </Head>
        <OfflineBanner />
        <PWAInstallBanner />
        <ThemeProvider>
          <ColumnContext.Provider value={{ columns, setColumns }}>
            <AppSettingsContext.Provider value={{ appHeading, setAppHeading, appSubheading, setAppSubheading, appLogo, setAppLogo, refreshSettings }}>
              <AppointmentsCountProvider>
                <Component {...pageProps} />
              </AppointmentsCountProvider>
            </AppSettingsContext.Provider>
          </ColumnContext.Provider>
        </ThemeProvider>
      </PWAProvider>
    </SessionProvider>
  );
}
