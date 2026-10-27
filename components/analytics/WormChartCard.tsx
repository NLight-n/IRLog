import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Chart from '../common/Chart';

const MODALITIES = ['All', 'USG', 'CT', 'OT', 'XF', 'DSA'];

const CURRENT_MONTH_COLOR = '#2563eb'; // Vibrant Royal Blue

// 12 distinct curated colors for the 12 previous months
const PAST_MONTH_COLORS = [
  '#10b981', // Month 1 (Previous): Emerald Green
  '#f59e0b', // Month 2: Amber
  '#ec4899', // Month 3: Pink
  '#8b5cf6', // Month 4: Purple
  '#06b6d4', // Month 5: Cyan
  '#f97316', // Month 6: Orange
  '#14b8a6', // Month 7: Teal
  '#a855f7', // Month 8: Violet
  '#e11d48', // Month 9: Rose
  '#84cc16', // Month 10: Lime
  '#6366f1', // Month 11: Indigo
  '#d97706', // Month 12: Bronze
];

interface CumulativeMonthData {
  key: string;
  label: string;
  total: number;
  totalCost?: number;
  currentDay?: number;
  countAtCurrentDay?: number;
  costAtCurrentDay?: number;
  daysInMonth: number;
  offset?: number;
  data: (number | null)[];
  costData?: (number | null)[];
}

interface CumulativeResponse {
  labels: string[];
  currentMonth: CumulativeMonthData;
  months: (CumulativeMonthData & { offset: number })[];
}

interface WormChartCardProps {
  isDarkMode?: boolean;
}

export default function WormChartCard({ isDarkMode = false }: WormChartCardProps) {
  const [modality, setModality] = useState('All');
  const [metric, setMetric] = useState<'count' | 'cost'>('count');
  const [data, setData] = useState<CumulativeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected past month offsets (1 = previous month, 2 = 2 months ago, ..., 12)
  // Default is [1] (previous month line shown by default alongside current month)
  const [selectedOffsets, setSelectedOffsets] = useState<number[]>([1]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const url = new URL('/api/procedures/analytics', window.location.origin);
    url.searchParams.set('type', 'cumulative');
    if (modality && modality !== 'All') {
      url.searchParams.set('modality', modality);
    }

    fetch(url.toString())
      .then(res => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then(d => {
        if (!cancelled) {
          setData(d);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(typeof e === 'string' ? e : 'Failed to load cumulative trends');
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
  }, [modality]);

  const toggleOffset = useCallback((offset: number) => {
    setSelectedOffsets(prev => {
      if (prev.includes(offset)) {
        return prev.filter(o => o !== offset);
      }
      return [...prev, offset].sort((a, b) => a - b);
    });
  }, []);

  const selectPreviousOnly = useCallback(() => {
    setSelectedOffsets([1]);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedOffsets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  }, []);

  const clearAll = useCallback(() => {
    setSelectedOffsets([]);
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

    // 1. Current Month Line (Always shown)
    const curDay = data.currentMonth.currentDay || 1;
    const curData = metric === 'cost' ? (data.currentMonth.costData || data.currentMonth.data) : data.currentMonth.data;
    seriesList.push({
      name: `${data.currentMonth.label} (Current)`,
      data: curData,
      color: CURRENT_MONTH_COLOR,
      borderWidth: 3,
      fill: false,
      tension: 0.25,
      // Highlight the endpoint of today with a prominent dot
      pointRadius: (ctx: any) => {
        if (ctx.dataIndex === curDay - 1) return 6;
        return 0;
      },
      pointHoverRadius: 6,
    });

    // 2. Selected Past Months Lines
    selectedOffsets.forEach(offset => {
      const pastMonth = data.months.find(m => m.offset === offset);
      if (pastMonth) {
        const color = PAST_MONTH_COLORS[(offset - 1) % PAST_MONTH_COLORS.length];
        const pastData = metric === 'cost' ? (pastMonth.costData || pastMonth.data) : pastMonth.data;
        seriesList.push({
          name: pastMonth.label,
          data: pastData,
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
  }, [data, selectedOffsets, metric]);

  const currentDay = data?.currentMonth.currentDay || new Date().getDate();

  return (
    <div className="card mb-8" style={{ padding: 24 }}>
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h4 className="mb-0 text-lg font-medium">{metric === 'count' ? 'Cumulative Case Trends' : 'Cumulative Cost Trends'}</h4>
          </div>
          <p className="text-xs text-muted" style={{ margin: '4px 0 0 0', color: isDarkMode ? '#a1a1aa' : '#6b7280' }}>
            {metric === 'count'
              ? 'Day-by-day cumulative case count comparison. Current month line always shown.'
              : 'Day-by-day cumulative procedure cost comparison (\u20B9). Current month line always shown.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Count / Cost Toggle */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: isDarkMode ? '#1e293b' : '#f1f5f9',
              borderRadius: 8,
              padding: 2,
              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
            }}
          >
            <button
              type="button"
              onClick={() => setMetric('count')}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: metric === 'count' ? 600 : 500,
                borderRadius: 6,
                border: 'none',
                background: metric === 'count' ? 'var(--color-accent)' : 'transparent',
                color: metric === 'count' ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Case Count
            </button>
            <button
              type="button"
              onClick={() => setMetric('cost')}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: metric === 'cost' ? 600 : 500,
                borderRadius: 6,
                border: 'none',
                background: metric === 'cost' ? 'var(--color-accent)' : 'transparent',
                color: metric === 'cost' ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Case Cost
            </button>
          </div>

          {/* Modality Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label className="block text-sm font-medium" htmlFor="worm-modality" style={{ margin: 0 }}>
              Modality
            </label>
            <select
              id="worm-modality"
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
      </div>

      {/* Main Chart Area with Side Legend */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-muted, #6b7280)' }}>
          Loading cumulative trends...
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
                highlightLabel={currentDay.toString()}
                isDarkMode={isDarkMode}
                dualAxis={false}
                showLegend={false}
                currency="₹"
                yAxisType={metric}
              />
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  marginTop: 6,
                  color: isDarkMode ? '#71717a' : '#9ca3af',
                }}
              >
                {metric === 'count'
                  ? 'X-Axis: Days of Month (1 – 31) • Y-Axis: Cumulative Case Count'
                  : 'X-Axis: Days of Month (1 – 31) • Y-Axis: Cumulative Procedure Cost (₹)'}
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
                <span style={{ fontSize: 11, fontWeight: 'normal' }}>Day {currentDay} today</span>
              </div>

              {/* Current Month Card */}
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                  border: `1.5px solid ${CURRENT_MONTH_COLOR}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: CURRENT_MONTH_COLOR,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 12, color: isDarkMode ? '#ffffff' : '#111827' }}>
                    {data.currentMonth.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: CURRENT_MONTH_COLOR,
                      color: '#ffffff',
                      marginLeft: 'auto',
                    }}
                  >
                    Current
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                  <span style={{ color: isDarkMode ? '#a1a1aa' : '#6b7280' }}>
                    {metric === 'count' ? 'Cases to date:' : 'Cost to date:'}
                  </span>
                  <span style={{ fontWeight: 700, color: CURRENT_MONTH_COLOR }}>
                    {metric === 'count'
                      ? `${data.currentMonth.total} cases`
                      : `\u20B9${Number(data.currentMonth.totalCost || 0).toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>

              {/* Active Selected Past Months */}
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
                {selectedOffsets.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: isDarkMode ? '#71717a' : '#9ca3af',
                      padding: '12px 4px',
                      textAlign: 'center',
                    }}
                  >
                    No past months selected. Click any button below to compare.
                  </div>
                ) : (
                  selectedOffsets.map(offset => {
                    const m = data.months.find(pm => pm.offset === offset);
                    if (!m) return null;
                    const color = PAST_MONTH_COLORS[(offset - 1) % PAST_MONTH_COLORS.length];
                    const atDayDiff = metric === 'count'
                      ? (data.currentMonth.total || 0) - (m.countAtCurrentDay || 0)
                      : (data.currentMonth.totalCost || 0) - (m.costAtCurrentDay || 0);

                    return (
                      <div
                        key={m.key}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f9fafb',
                          border: `1px solid ${isDarkMode ? '#27272a' : '#e5e7eb'}`,
                          borderLeft: `4px solid ${color}`,
                        }}
                      >
                        {/* Line 1: Month Name, Total, and Remove Button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: isDarkMode ? '#f4f4f5' : '#18181b', whiteSpace: 'nowrap' }}>
                            {m.label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#d4d4d8' : '#374151' }}>
                              {metric === 'count'
                                ? `${m.total} cases`
                                : `\u20B9${Number(m.totalCost || 0).toLocaleString('en-IN')}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleOffset(offset)}
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
                        {/* Line 2: Day X progress and delta vs current month */}
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
                          <span>
                            Day {currentDay}:{' '}
                            <strong style={{ color: isDarkMode ? '#e4e4e7' : '#1f2937' }}>
                              {metric === 'count'
                                ? m.countAtCurrentDay
                                : `\u20B9${Number(m.costAtCurrentDay || 0).toLocaleString('en-IN')}`}
                            </strong>
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: atDayDiff > 0 ? '#10b981' : atDayDiff < 0 ? '#ef4444' : '#6b7280',
                            }}
                          >
                            {metric === 'count'
                              ? (atDayDiff >= 0 ? `+${atDayDiff}` : atDayDiff)
                              : (atDayDiff >= 0 ? `+\u20B9${atDayDiff.toLocaleString('en-IN')}` : `-\u20B9${Math.abs(atDayDiff).toLocaleString('en-IN')}`)}{' '}
                            vs today
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 12 Month Buttons Selector Section */}
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
                  Toggle Past 12 Months:
                </span>
                {/* Current Month Fixed Indicator */}
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
                    color: CURRENT_MONTH_COLOR,
                    border: `1px solid ${CURRENT_MONTH_COLOR}`,
                  }}
                  title="Current month line is always displayed on the graph"
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: CURRENT_MONTH_COLOR,
                    }}
                  />
                  {data.currentMonth.label} (Always Active)
                </span>
              </div>

              {/* Quick Action Buttons */}
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
                  Previous Month Only
                </button>
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
                  Select All 12
                </button>
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
            </div>

            {/* Grid of 12 Month Buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 8,
              }}
            >
              {data.months.map(m => {
                const isSelected = selectedOffsets.includes(m.offset);
                const color = PAST_MONTH_COLORS[(m.offset - 1) % PAST_MONTH_COLORS.length];

                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleOffset(m.offset)}
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
                        {m.label}
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
                      {metric === 'count'
                        ? `${m.total} cases`
                        : `\u20B9${Number(m.totalCost || 0).toLocaleString('en-IN')}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
