import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import '../styles/global.css';
import { ThemeProvider } from '../lib/theme/ThemeContext';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ColumnContext, defaultColumns } from '../lib/columnContext';

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
          setAppLogo(`/api/logo?t=${Date.now()}`);
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

  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <ColumnContext.Provider value={{ columns, setColumns }}>
          <AppSettingsContext.Provider value={{ appHeading, setAppHeading, appSubheading, setAppSubheading, appLogo, setAppLogo, refreshSettings }}>
            <Component {...pageProps} />
          </AppSettingsContext.Provider>
        </ColumnContext.Provider>
      </ThemeProvider>
    </SessionProvider>
  );
} 