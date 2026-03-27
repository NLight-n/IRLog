import React, { useState, useRef, useEffect, useCallback } from 'react';
import NavBar from '../components/layout/NavBar';
import { useSession } from 'next-auth/react';
import { useTheme } from '../lib/theme/ThemeContext';
import { useAppSettings } from './_app';
import Chart from '../components/common/Chart';
import { useRouter } from 'next/router';

const MODALITIES = ['All', 'USG', 'CT', 'OT', 'XF', 'DSA'];

function useAnalyticsData(type: string, params: Record<string, string | undefined>) {
  const [data, setData] = React.useState<{ labels: string[]; series: { name: string; data: number[] }[]; monthLabel?: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    setLoading(true);
    setError('');
    const url = new URL('/api/procedures/analytics', window.location.origin);
    url.searchParams.set('type', type);
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    fetch(url.toString())
      .then(res => res.ok ? res.json() : Promise.reject(res.statusText))
      .then(d => {
        if (d.data) {
          setData({ labels: d.labels, series: [{ name: type, data: d.data }], monthLabel: d.monthLabel });
        } else {
          setData({ ...d, monthLabel: d.monthLabel });
        }
      })
      .catch(e => setError(typeof e === 'string' ? e : 'Error'))
      .finally(() => setLoading(false));
  }, [type, ...Object.values(params)]);
  return { data, loading, error };
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { appHeading, appSubheading, appLogo } = useAppSettings();

  // Monthly Trends filter
  const [monthlyModality, setMonthlyModality] = useState('All');
  // Monthly Trends navigation offset (0 = current, 1 = 1 month back, etc.)
  const [monthOffset, setMonthOffset] = useState(0);

  // Timer ref for distinguishing single vs double click on right arrow
  const rightClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRightArrowClick = useCallback(() => {
    if (rightClickTimer.current) {
      // Second click arrived quickly — treat as double-click
      clearTimeout(rightClickTimer.current);
      rightClickTimer.current = null;
      setMonthOffset(0);
    } else {
      // First click — wait briefly to see if a second click follows
      rightClickTimer.current = setTimeout(() => {
        rightClickTimer.current = null;
        setMonthOffset(prev => Math.max(0, prev - 1));
      }, 250);
    }
  }, []);

  // Daily Trends filter & navigation
  const [dailyModality, setDailyModality] = useState('All');
  const [dailyOffset, setDailyOffset] = useState(0);

  const dailyRightClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDailyRightArrowClick = useCallback(() => {
    if (dailyRightClickTimer.current) {
      clearTimeout(dailyRightClickTimer.current);
      dailyRightClickTimer.current = null;
      setDailyOffset(0);
    } else {
      dailyRightClickTimer.current = setTimeout(() => {
        dailyRightClickTimer.current = null;
        setDailyOffset(prev => Math.max(0, prev - 1));
      }, 250);
    }
  }, []);

  // Yearly Trends filter
  const [yearlyModality, setYearlyModality] = useState('All');
  // By Modality filter
  const [modalityDateFrom, setModalityDateFrom] = useState('');
  const [modalityDateTo, setModalityDateTo] = useState('');
  // By Physician filter
  const [physicianDateFrom, setPhysicianDateFrom] = useState('');
  const [physicianDateTo, setPhysicianDateTo] = useState('');

  // Chart data hooks
  // Compute highlight labels for current month and current day
  const _now = new Date();
  const _monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthLabel = `${_monthNames[_now.getMonth()]} ${_now.getFullYear()}`;
  const currentDayLabel = _now.getDate().toString();

  const monthly = useAnalyticsData('monthly', { modality: monthlyModality, monthOffset: monthOffset.toString() });
  const daily = useAnalyticsData('daily', { modality: dailyModality, monthOffset: dailyOffset.toString() });
  const modalityTrends = useAnalyticsData('modality', { dateFrom: modalityDateFrom, dateTo: modalityDateTo });
  const physician = useAnalyticsData('physician', { dateFrom: physicianDateFrom, dateTo: physicianDateTo });
  const yearly = useAnalyticsData('yearly', { modality: yearlyModality });

  const router = useRouter();
  const navbarRef = useRef<HTMLDivElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(0);
  useEffect(() => {
    let frame: number;
    let lastHeight = 0;
    let stableCount = 0;
    function measure() {
      if (navbarRef.current) {
        const h = navbarRef.current.offsetHeight;
        if (h !== lastHeight) {
          lastHeight = h;
          stableCount = 0;
          setNavbarHeight(h);
        } else {
          stableCount++;
        }
        if (stableCount < 3) {
          frame = requestAnimationFrame(measure);
        }
      }
    }
    function updateNavbarHeight() {
      lastHeight = 0;
      stableCount = 0;
      frame = requestAnimationFrame(measure);
    }
    updateNavbarHeight();
    window.addEventListener('resize', updateNavbarHeight);
    router.events?.on('routeChangeComplete', updateNavbarHeight);
    return () => {
      window.removeEventListener('resize', updateNavbarHeight);
      router.events?.off('routeChangeComplete', updateNavbarHeight);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [router.events]);

  return (
    <>
      <NavBar ref={navbarRef} user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
      <div className="container" style={{ maxWidth: 1100, margin: '0 auto', paddingTop: navbarHeight + 8 }}>
        <h2 className="mb-6" style={{ color: 'var(--color-accent)' }}>Analytics</h2>
        {/* Monthly Trends Card */}
        <div className="card mb-8" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 className="mb-0 text-lg font-medium">Monthly Trends</h4>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="monthly-modality">Modality</label>
              <select id="monthly-modality" className="form-input" value={monthlyModality} onChange={e => setMonthlyModality(e.target.value)}>
                {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {/* Left Arrow - go to older months */}
            <button
              type="button"
              onClick={() => setMonthOffset(prev => prev + 1)}
              title="Show older months"
              style={{
                background: 'none',
                border: '1px solid var(--color-border, #d1d5db)',
                borderRadius: '8px',
                cursor: 'pointer',
                padding: '8px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
                flexShrink: 0,
                transition: 'background 0.2s, transform 0.15s',
                marginRight: 4,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-subtle, rgba(59,130,246,0.1))'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            {/* Chart */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {monthly.loading ? <div>Loading...</div> : monthly.error ? <div style={{ color: 'red' }}>{monthly.error}</div> : monthly.data && <Chart type="line" labels={monthly.data.labels} series={monthly.data.series} title="Monthly Trends" height={380} highlightLabel={currentMonthLabel} isDarkMode={theme === 'dark'} />}
            </div>
            {/* Right Arrow - go to newer months */}
            <button
              type="button"
              onClick={handleRightArrowClick}
              disabled={monthOffset === 0}
              title={monthOffset === 0 ? 'Already showing latest data' : 'Show newer months (double-click to reset)'}
              style={{
                background: 'none',
                border: '1px solid var(--color-border, #d1d5db)',
                borderRadius: '8px',
                cursor: monthOffset === 0 ? 'not-allowed' : 'pointer',
                padding: '8px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: monthOffset === 0 ? 'var(--color-text-muted, #9ca3af)' : 'var(--color-accent)',
                opacity: monthOffset === 0 ? 0.5 : 1,
                flexShrink: 0,
                transition: 'background 0.2s, transform 0.15s, opacity 0.2s',
                marginLeft: 4,
              }}
              onMouseEnter={e => { if (monthOffset > 0) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-subtle, rgba(59,130,246,0.1))'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
          {/* Range indicator */}
          {monthly.data && monthly.data.labels.length > 0 && monthOffset > 0 && (
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: 'var(--color-text-muted, #6b7280)' }}>
              Showing: {monthly.data.labels[0]} — {monthly.data.labels[monthly.data.labels.length - 1]}
              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                style={{
                  marginLeft: 12,
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 13,
                  padding: 0,
                }}
              >
                Reset to current
              </button>
            </div>
          )}
        </div>
        {/* Daily Trends Card */}
        <div className="card mb-8" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 className="mb-0 text-lg font-medium">Daily Trends{daily.data?.monthLabel ? ` — ${daily.data.monthLabel}` : ''}</h4>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="daily-modality">Modality</label>
              <select id="daily-modality" className="form-input" value={dailyModality} onChange={e => setDailyModality(e.target.value)}>
                {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {/* Left Arrow - go to previous month */}
            <button
              type="button"
              onClick={() => setDailyOffset(prev => prev + 1)}
              title="Show previous month"
              style={{
                background: 'none',
                border: '1px solid var(--color-border, #d1d5db)',
                borderRadius: '8px',
                cursor: 'pointer',
                padding: '8px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
                flexShrink: 0,
                transition: 'background 0.2s, transform 0.15s',
                marginRight: 4,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-subtle, rgba(59,130,246,0.1))'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            {/* Chart */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {daily.loading ? <div>Loading...</div> : daily.error ? <div style={{ color: 'red' }}>{daily.error}</div> : daily.data && <Chart type="bar" labels={daily.data.labels} series={daily.data.series} title={`Daily Trends \u2014 ${daily.data.monthLabel || ''}`} height={380} stacked highlightLabel={dailyOffset === 0 ? currentDayLabel : undefined} isDarkMode={theme === 'dark'} />}
            </div>
            {/* Right Arrow - go to next month */}
            <button
              type="button"
              onClick={handleDailyRightArrowClick}
              disabled={dailyOffset === 0}
              title={dailyOffset === 0 ? 'Already showing current month' : 'Show next month (double-click to reset)'}
              style={{
                background: 'none',
                border: '1px solid var(--color-border, #d1d5db)',
                borderRadius: '8px',
                cursor: dailyOffset === 0 ? 'not-allowed' : 'pointer',
                padding: '8px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: dailyOffset === 0 ? 'var(--color-text-muted, #9ca3af)' : 'var(--color-accent)',
                opacity: dailyOffset === 0 ? 0.5 : 1,
                flexShrink: 0,
                transition: 'background 0.2s, transform 0.15s, opacity 0.2s',
                marginLeft: 4,
              }}
              onMouseEnter={e => { if (dailyOffset > 0) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-subtle, rgba(59,130,246,0.1))'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
          {/* Range indicator */}
          {daily.data && dailyOffset > 0 && (
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: 'var(--color-text-muted, #6b7280)' }}>
              Showing: {daily.data.monthLabel}
              <button
                type="button"
                onClick={() => setDailyOffset(0)}
                style={{
                  marginLeft: 12,
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 13,
                  padding: 0,
                }}
              >
                Reset to current
              </button>
            </div>
          )}
        </div>
        {/* By Modality and By Referring Physician Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="card p-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 className="mb-0 text-lg font-medium">By Modality</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="modality-date-from">Date From</label>
                  <input id="modality-date-from" type="date" className="form-input" value={modalityDateFrom} onChange={e => setModalityDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="modality-date-to">Date To</label>
                  <input id="modality-date-to" type="date" className="form-input" value={modalityDateTo} onChange={e => setModalityDateTo(e.target.value)} />
                </div>
              </div>
            </div>
            {modalityTrends.loading ? <div>Loading...</div> : modalityTrends.error ? <div style={{ color: 'red' }}>{modalityTrends.error}</div> : modalityTrends.data && <Chart type="bar" labels={modalityTrends.data.labels} series={modalityTrends.data.series} title="By Modality" />}
          </div>
          <div className="card p-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 className="mb-0 text-lg font-medium">By Referring Physician</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="physician-date-from">Date From</label>
                  <input id="physician-date-from" type="date" className="form-input" value={physicianDateFrom} onChange={e => setPhysicianDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="physician-date-to">Date To</label>
                  <input id="physician-date-to" type="date" className="form-input" value={physicianDateTo} onChange={e => setPhysicianDateTo(e.target.value)} />
                </div>
              </div>
            </div>
            {physician.loading ? <div>Loading...</div> : physician.error ? <div style={{ color: 'red' }}>{physician.error}</div> : physician.data && <Chart type="horizontalBar" labels={physician.data.labels} series={physician.data.series} title="By Referring Physician" />}
          </div>
        </div>
        {/* Yearly Trends Card */}
        <div className="card mb-8 p-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 className="mb-0 text-lg font-medium">Yearly Trends</h4>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="yearly-modality">Modality</label>
              <select id="yearly-modality" className="form-input" value={yearlyModality} onChange={e => setYearlyModality(e.target.value)}>
                {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {yearly.loading ? <div>Loading...</div> : yearly.error ? <div style={{ color: 'red' }}>{yearly.error}</div> : yearly.data && <Chart type="bar" labels={yearly.data.labels} series={yearly.data.series} title="Yearly Trends" />}
        </div>
      </div>
    </>
  );
} 