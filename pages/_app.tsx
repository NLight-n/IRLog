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
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    let urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (input && typeof input === 'object' && 'url' in input) {
      urlStr = (input as any).url;
    }

    if (basePath && urlStr.startsWith('/api/')) {
      const rewritten = basePath + urlStr;
      if (typeof input === 'string') {
        return originalFetch(rewritten, init);
      } else if (input instanceof URL) {
        return originalFetch(new URL(rewritten, window.location.origin), init);
      } else {
        const newReq = new Request(rewritten, input as Request);
        return originalFetch(newReq, init);
      }
    } else if (basePath && urlStr.startsWith(window.location.origin + '/api/')) {
      const relativePart = urlStr.substring(window.location.origin.length);
      const rewritten = window.location.origin + basePath + relativePart;
      if (typeof input === 'string') {
        return originalFetch(rewritten, init);
      } else if (input instanceof URL) {
        return originalFetch(new URL(rewritten), init);
      } else {
        const newReq = new Request(rewritten, input as Request);
        return originalFetch(newReq, init);
      }
    }
    return originalFetch(input, init);
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

  // Fetch settings on mount or when needed
  const refreshSettings = () => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.appHeading) setAppHeading(data.appHeading);
        if (data.appSubheading !== undefined) setAppSubheading(data.appSubheading);
        // Use /api/logo endpoint if logo exists, with cache busting
        if (data.hasLogo) {
          setAppLogo(`${basePath}/api/logo?t=${Date.now()}`);
        } else {
          setAppLogo('');
        }
      });
  };
  useEffect(() => {
    refreshSettings();
  }, []);

  useEffect(() => {
    async function fetchAndMergeColumns() {
      try {
        const res = await fetch('/api/users/profile');
        if (res.ok) {
          const data = await res.json();
          let userCols = Array.isArray(data.columns) ? data.columns : defaultColumns;
          // Only keep columns that exist in defaultColumns
          userCols = userCols.filter((uc: any) => defaultColumns.some(dc => dc.key === uc.key));
          // Merge in any missing columns from defaultColumns
          const userColKeys = userCols.map((uc: any) => uc.key);
          const mergedCols = [
            ...userCols,
            ...defaultColumns.filter(dc => !userColKeys.includes(dc.key))
          ];
          setColumns(mergedCols);
        } else {
          setColumns(defaultColumns);
        }
      } catch {
        setColumns(defaultColumns);
      }
    }
    fetchAndMergeColumns();
  }, []);

  // Register PWA Service Worker with explicit scope
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register immediately. Waiting for window.load can miss the event in a PWA.
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
          <meta name="theme-color" content="#3b82f6" />
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
