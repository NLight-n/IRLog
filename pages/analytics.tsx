import React, { useState, useRef, useEffect } from 'react';
import NavBar from '../components/layout/NavBar';
import { useSession } from 'next-auth/react';
import { useTheme } from '../lib/theme/ThemeContext';
import { useAppSettings } from './_app';
import Chart from '../components/common/Chart';
import { useRouter } from 'next/router';

const MODALITIES = ['All', 'USG', 'CT', 'OT', 'XF', 'DSA'];

function useAnalyticsData(type: string, params: Record<string, string | undefined>) {
  const [data, setData] = React.useState<{ labels: string[]; series: { name: string; data: number[] }[] } | null>(null);
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
          setData({ labels: d.labels, series: [{ name: type, data: d.data }] });
        } else {
          setData(d);
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
  // Yearly Trends filter
  const [yearlyModality, setYearlyModality] = useState('All');
  // By Modality filter
  const [modalityDateFrom, setModalityDateFrom] = useState('');
  const [modalityDateTo, setModalityDateTo] = useState('');
  // By Physician filter
  const [physicianDateFrom, setPhysicianDateFrom] = useState('');
  const [physicianDateTo, setPhysicianDateTo] = useState('');

  // Chart data hooks
  const monthly = useAnalyticsData('monthly', { modality: monthlyModality });
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
          {monthly.loading ? <div>Loading...</div> : monthly.error ? <div style={{ color: 'red' }}>{monthly.error}</div> : monthly.data && <Chart type="line" labels={monthly.data.labels} series={monthly.data.series} title="Monthly Trends" height={380} />}
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