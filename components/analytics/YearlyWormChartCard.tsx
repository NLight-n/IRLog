import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Chart from '../common/Chart';

const MODALITIES = ['All', 'USG', 'CT', 'OT', 'XF', 'DSA'];

const CURRENT_YEAR_COLOR = '#2563eb'; // Vibrant Royal Blue

// Curated distinguishable colors for past years
const PAST_YEAR_COLORS = [
  '#10b981', // Previous Year: Emerald Green
  '#f59e0b', // 2 Years Ago: Amber
  '#ec4899', // 3 Years Ago: Pink
  '#8b5cf6', // 4 Years Ago: Purple
  '#06b6d4', // 5 Years Ago: Cyan
  '#f97316', // 6 Years Ago: Orange
  '#14b8a6', // 7 Years Ago: Teal
  '#a855f7', // 8 Years Ago: Violet
  '#e11d48', // 9 Years Ago: Rose
  '#84cc16', // 10 Years Ago: Lime
  '#6366f1', // 11 Years Ago: Indigo
  '#d97706', // 12 Years Ago: Bronze
];

interface CumulativeYearData {
  year: number;
  label: string;
  total: number;
  currentMonth?: number;
  currentMonthName?: string;
  countAtCurrentMonth?: number;
  data: (number | null)[];
}

interface CumulativeYearlyResponse {
  labels: string[];
  currentYear: CumulativeYearData;
  years: CumulativeYearData[];
}

interface YearlyWormChartCardProps {
  isDarkMode?: boolean;
}

export default function YearlyWormChartCard({ isDarkMode = false }: YearlyWormChartCardProps) {
  const [modality, setModality] = useState('All');
  const [data, setData] = useState<CumulativeYearlyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected past years (by default, the immediately preceding year is selected)
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [initializedDefault, setInitializedDefault] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const url = new URL('/api/procedures/analytics', window.location.origin);
    url.searchParams.set('type', 'yearly');
    if (modality && modality !== 'All') {
      url.searchParams.set('modality', modality);
    }

    fetch(url.toString())
      .then(res => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((d: CumulativeYearlyResponse) => {
        if (!cancelled) {
          setData(d);
          // Set default selected year to previous year on first load
          if (!initializedDefault && d.years && d.years.length > 0) {
            setSelectedYears([d.years[0].year]);
            setInitializedDefault(true);
          }
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(typeof e === 'string' ? e : 'Failed to load yearly cumulative trends');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [modality, initializedDefault]);

  const toggleYear = useCallback((year: number) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      }
      return [...prev, year].sort((a, b) => b - a);
    });
  }, []);

  const selectPreviousOnly = useCallback(() => {
    if (data?.years && data.years.length > 0) {
      setSelectedYears([data.years[0].year]);
    }
  }, [data]);

  const selectAll = useCallback(() => {
    if (data?.years) {
      setSelectedYears(data.years.map(y => y.year));
    }
  }, [data]);

  const clearAll = useCallback(() => {
    setSelectedYears([]);
  }, []);

  // Compute Chart Series
  const chartSeries = useMemo(() => {
    if (!data) return [];

    const seriesList: {
      name: string;
      data: (number | null)[];
      color: string;
      borderWidth: number;
      fill: boolean;
      tension: number;
      pointRadius?: any;
      pointHoverRadius?: number;
    }[] = [];

    // 1. Current Year Line (Always shown)
    const curMonth = data.currentYear.currentMonth ?? new Date().getMonth();
    seriesList.push({
      name: `${data.currentYear.label} (Current)`,
      data: data.currentYear.data,
      color: CURRENT_YEAR_COLOR,
      borderWidth: 3,
      fill: false,
      tension: 0.25,
      // Highlight current month endpoint with a prominent dot
      pointRadius: (ctx: any) => {
        if (ctx.dataIndex === curMonth) return 6;
        return 0;
      },
      pointHoverRadius: 6,
    });

    // 2. Selected Past Years Lines
    selectedYears.forEach(year => {
      const pastYearIndex = data.years.findIndex(y => y.year === year);
      const pastYear = data.years[pastYearIndex];
      if (pastYear) {
        const color = PAST_YEAR_COLORS[pastYearIndex % PAST_YEAR_COLORS.length];
        seriesList.push({
          name: pastYear.label,
          data: pastYear.data,
          color,
          borderWidth: 2,
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 5,
        });
      }
    });

    return seriesList;
  }, [data, selectedYears]);

  const curMonthName = data?.currentYear.currentMonthName || 'Current Month';

  return (
    <div className="card mb-8" style={{ padding: 24 }}>
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h4 className="mb-0 text-lg font-medium">Cumulative Yearly Trends</h4>
          </div>
          <p className="text-xs text-muted" style={{ margin: '4px 0 0 0', color: isDarkMode ? '#a1a1aa' : '#6b7280' }}>
            Month-by-month cumulative case count comparison across years. Current year line always shown.
          </p>
        </div>

        {/* Modality Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="block text-sm font-medium" htmlFor="yearly-worm-modality" style={{ margin: 0 }}>
            Modality
          </label>
          <select
            id="yearly-worm-modality"
            className="form-input"
            value={modality}
            onChange={e => setModality(e.target.value)}
          >
            {MODALITIES.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Chart Area with Side Legend */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-muted, #6b7280)' }}>
          Loading yearly cumulative trends...
        </div>
      ) : error ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#ef4444' }}>{error}</div>
      ) : data ? (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 16,
              alignItems: 'stretch',
              flexWrap: 'wrap',
            }}
          >
            {/* Chart Area */}
            <div style={{ flex: '1 1 640px', minWidth: 0 }}>
              <Chart
                type="line"
                labels={data.labels}
                series={chartSeries}
                height={380}
                highlightLabel={curMonthName}
                isDarkMode={isDarkMode}
                dualAxis={false}
                showLegend={false}
              />
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  marginTop: 6,
                  color: isDarkMode ? '#71717a' : '#9ca3af',
                }}
              >
                X-Axis: Months (Jan – Dec) • Y-Axis: Cumulative Case Count
              </div>
            </div>

            {/* Side Legend Panel */}
            <div
              style={{
                flex: '0 0 260px',
                minWidth: 240,
                borderLeft: isDarkMode ? '1px solid #27272a' : '1px solid #e5e7eb',
                paddingLeft: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isDarkMode ? '#a1a1aa' : '#6b7280',
                  marginBottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Legend & Stats</span>
                <span style={{ fontSize: 11, fontWeight: 'normal' }}>{curMonthName} today</span>
              </div>

              {/* Current Year Card */}
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                  border: `1.5px solid ${CURRENT_YEAR_COLOR}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: CURRENT_YEAR_COLOR,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 12, color: isDarkMode ? '#ffffff' : '#111827' }}>
                    {data.currentYear.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: CURRENT_YEAR_COLOR,
                      color: '#ffffff',
                      marginLeft: 'auto',
                    }}
                  >
                    Current
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                  <span style={{ color: isDarkMode ? '#a1a1aa' : '#6b7280' }}>Cases to date:</span>
                  <span style={{ fontWeight: 700, color: CURRENT_YEAR_COLOR }}>
                    {data.currentYear.total} cases
                  </span>
                </div>
              </div>

              {/* Active Selected Past Years */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 280,
                  overflowY: 'auto',
                  paddingRight: 2,
                }}
              >
                {selectedYears.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: isDarkMode ? '#71717a' : '#9ca3af',
                      padding: '12px 4px',
                      textAlign: 'center',
                    }}
                  >
                    No past years selected. Click any button below to compare.
                  </div>
                ) : (
                  selectedYears.map(year => {
                    const pastYearIndex = data.years.findIndex(y => y.year === year);
                    const y = data.years[pastYearIndex];
                    if (!y) return null;
                    const color = PAST_YEAR_COLORS[pastYearIndex % PAST_YEAR_COLORS.length];
                    const atMonthDiff = (data.currentYear.total || 0) - (y.countAtCurrentMonth || 0);

                    return (
                      <div
                        key={y.year}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f9fafb',
                          border: `1px solid ${isDarkMode ? '#27272a' : '#e5e7eb'}`,
                          borderLeft: `4px solid ${color}`,
                        }}
                      >
                        {/* Line 1: Year, Total Cases, and Remove Button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: isDarkMode ? '#f4f4f5' : '#18181b', whiteSpace: 'nowrap' }}>
                            {y.label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#d4d4d8' : '#374151' }}>
                              {y.total} cases
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleYear(year)}
                              title="Remove line"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: isDarkMode ? '#71717a' : '#9ca3af',
                                padding: 0,
                                fontSize: 14,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {/* Line 2: At current month progress and delta vs current year */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 11,
                            marginTop: 3,
                            color: isDarkMode ? '#a1a1aa' : '#6b7280',
                          }}
                        >
                          <span>At {curMonthName}: <strong style={{ color: isDarkMode ? '#e4e4e7' : '#1f2937' }}>{y.countAtCurrentMonth}</strong></span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: atMonthDiff > 0 ? '#10b981' : atMonthDiff < 0 ? '#ef4444' : '#6b7280',
                            }}
                          >
                            {atMonthDiff >= 0 ? `+${atMonthDiff}` : atMonthDiff} vs today
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Past Years Toggle Buttons Row */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: isDarkMode ? '1px solid #27272a' : '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#e4e4e7' : '#374151' }}>
                  Toggle Past Years:
                </span>
                {/* Current Year Fixed Indicator */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: isDarkMode ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
                    color: CURRENT_YEAR_COLOR,
                    border: `1px solid ${CURRENT_YEAR_COLOR}`,
                  }}
                  title="Current year line is always displayed on the graph"
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: CURRENT_YEAR_COLOR,
                    }}
                  />
                  {data.currentYear.label} (Always Active)
                </span>
              </div>

              {/* Quick Action Buttons */}
              {data.years.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={selectPreviousOnly}
                    className="text-xs"
                    style={{
                      background: 'none',
                      border: `1px solid ${isDarkMode ? '#3f3f46' : '#d1d5db'}`,
                      borderRadius: 6,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      color: isDarkMode ? '#d4d4d8' : '#4b5563',
                    }}
                  >
                    Previous Year Only
                  </button>
                  {data.years.length > 1 && (
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-xs"
                      style={{
                        background: 'none',
                        border: `1px solid ${isDarkMode ? '#3f3f46' : '#d1d5db'}`,
                        borderRadius: 6,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        color: isDarkMode ? '#d4d4d8' : '#4b5563',
                      }}
                    >
                      Select All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs"
                    style={{
                      background: 'none',
                      border: `1px solid ${isDarkMode ? '#3f3f46' : '#d1d5db'}`,
                      borderRadius: 6,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      color: isDarkMode ? '#d4d4d8' : '#4b5563',
                    }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Grid of Past Years Buttons */}
            {data.years.length === 0 ? (
              <div style={{ fontSize: 13, color: isDarkMode ? '#71717a' : '#9ca3af', fontStyle: 'italic' }}>
                No past year records found in database.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 8,
                }}
              >
                {data.years.map((y, idx) => {
                  const isSelected = selectedYears.includes(y.year);
                  const color = PAST_YEAR_COLORS[idx % PAST_YEAR_COLORS.length];

                  return (
                    <button
                      key={y.year}
                      type="button"
                      onClick={() => toggleYear(y.year)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '7px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease-in-out',
                        border: isSelected
                          ? `1.5px solid ${color}`
                          : `1px solid ${isDarkMode ? '#27272a' : '#e5e7eb'}`,
                        background: isSelected
                          ? isDarkMode
                            ? `${color}22`
                            : `${color}14`
                          : isDarkMode
                          ? '#18181b'
                          : '#ffffff',
                        boxShadow: isSelected ? `0 0 0 1px ${color}33` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: isSelected ? color : isDarkMode ? '#52525b' : '#d1d5db',
                            flexShrink: 0,
                            transition: 'background 0.15s',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected
                              ? isDarkMode
                                ? '#ffffff'
                                : '#111827'
                              : isDarkMode
                              ? '#a1a1aa'
                              : '#6b7280',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {y.label}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          marginTop: 2,
                          paddingLeft: 13,
                          color: isSelected ? color : isDarkMode ? '#71717a' : '#9ca3af',
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {y.total} cases
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
