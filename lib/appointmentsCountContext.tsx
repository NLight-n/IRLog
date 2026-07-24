import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface AppointmentsCountContextType {
  todayCount: number;
  refreshTodayCount: () => Promise<void>;
}

const AppointmentsCountContext = createContext<AppointmentsCountContextType>({
  todayCount: 0,
  refreshTodayCount: async () => {},
});

export const useAppointmentsCount = () => useContext(AppointmentsCountContext);

export const AppointmentsCountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [todayCount, setTodayCount] = useState<number>(0);
  const { status } = useSession();

  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const refreshTodayCount = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const now = new Date();
      const todayStr = formatDateKey(now);
      const tzOffset = now.getTimezoneOffset();
      const res = await fetch(`/api/worklist/today-count?date=${todayStr}&tzOffset=${tzOffset}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === 'number') {
          setTodayCount(data.count);
        }
      }
    } catch (err) {
      console.error('Failed to fetch appointments count:', err);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      refreshTodayCount();

      // Poll every 30 seconds
      const interval = setInterval(() => {
        refreshTodayCount();
      }, 30000);

      // Refresh on window focus
      const handleFocus = () => {
        refreshTodayCount();
      };
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
      };
    } else {
      setTodayCount(0);
    }
  }, [status, refreshTodayCount]);

  return (
    <AppointmentsCountContext.Provider value={{ todayCount, refreshTodayCount }}>
      {children}
    </AppointmentsCountContext.Provider>
  );
};
