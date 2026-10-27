import React, { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

export interface InBarLabelsConfig {
  values: (number | null)[];
  type: 'cost' | 'count';
  currency?: string;
}

interface ChartProps {
  type: 'bar' | 'line' | 'horizontalBar';
  labels: string[];
  data?: (number | null)[];
  series?: {
    name: string;
    data: (number | null)[];
    color?: string;
    pointStyle?: any;
    pointRadius?: number;
    pointHoverRadius?: number;
    borderWidth?: number;
    yAxisID?: string;
    fill?: boolean;
    tension?: number;
  }[];
  title?: string;
  color?: string;
  currency?: string;
  height?: number;
  stacked?: boolean;
  highlightLabel?: string;
  isDarkMode?: boolean;
  dualAxis?: boolean;
  legendPosition?: 'top' | 'right' | 'bottom' | 'left';
  showLegend?: boolean;
  inBarLabels?: InBarLabelsConfig;
  yAxisType?: 'cost' | 'count' | 'default';
}

const PALETTE = [
  'rgba(59, 130, 246, 0.7)',
  'rgba(239, 68, 68, 0.7)',
  'rgba(34, 197, 94, 0.7)',
  'rgba(249, 115, 22, 0.7)',
  'rgba(168, 85, 247, 0.7)',
];

/**
 * Calculates synchronized min, max, and step sizes for dual-axis charts
 * so that horizontal grid lines align exactly across both left and right axes.
 */
function calculateDualAxisBounds(s0Data: (number | null)[], s1Data: (number | null)[], intervals = 10) {
  const max0 = Math.max(...(s0Data || []).filter((v): v is number => v != null && !isNaN(v)), 1);
  const max1 = Math.max(...(s1Data || []).filter((v): v is number => v != null && !isNaN(v)), 1);

  function getNiceStep(val: number, isIntegerOnly: boolean) {
    const rawStep = val / intervals;
    if (rawStep <= 0) return 1;
    const exp = Math.floor(Math.log10(rawStep));
    const frac = rawStep / Math.pow(10, exp);
    let niceFrac: number;
    if (frac <= 1) niceFrac = 1;
    else if (frac <= 1.5) niceFrac = 1.5;
    else if (frac <= 2) niceFrac = 2;
    else if (frac <= 2.5) niceFrac = 2.5;
    else if (frac <= 3) niceFrac = 3;
    else if (frac <= 4) niceFrac = 4;
    else if (frac <= 5) niceFrac = 5;
    else if (frac <= 6) niceFrac = 6;
    else if (frac <= 8) niceFrac = 8;
    else niceFrac = 10;

    let step = niceFrac * Math.pow(10, exp);
    if (isIntegerOnly) {
      step = Math.max(1, Math.ceil(step));
    }
    return step;
  }

  const step0 = getNiceStep(max0, true);
  const niceMax0 = step0 * intervals;

  const step1 = getNiceStep(max1, false);
  const niceMax1 = step1 * intervals;

  return {
    axis0: { min: 0, max: niceMax0, stepSize: step0, count: intervals + 1 },
    axis1: { min: 0, max: niceMax1, stepSize: step1, count: intervals + 1 },
  };
}

/**
 * Creates a canvas rendering a small circular badge with '$' inside.
 */
function createDollarIcon(bgColor: string, textColor = '#ffffff', isDarkMode = false, size = 13) {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = size * scale;
  canvas.height = size * scale;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.scale(scale, scale);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1;

  // Outer circle badge
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Crisp ring
  ctx.lineWidth = 1;
  ctx.strokeStyle = isDarkMode ? '#18181b' : '#ffffff';
  ctx.stroke();

  // Small bold dollar symbol in center
  ctx.fillStyle = textColor;
  ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', cx, cy + 0.4);

  return canvas;
}

export default function Chart({
  type,
  labels,
  data,
  series,
  title,
  color,
  currency = '$',
  height = 320,
  stacked = false,
  highlightLabel,
  isDarkMode = false,
  dualAxis,
  legendPosition = 'top',
  showLegend,
  inBarLabels,
  yAxisType = 'default',
}: ChartProps) {
  // Determine if this is a dual-axis chart (e.g. Cases vs Cost)
  const isDualAxis = dualAxis ?? (!stacked && !!series && series.length === 2 && series.some(s => s.name.toLowerCase().includes('cost')));

  // Pre-calculate dual axis bounds if applicable
  const dualBounds = useMemo(() => {
    if (isDualAxis && series && series.length >= 2) {
      return calculateDualAxisBounds(series[0].data, series[1].data, 10);
    }
    return null;
  }, [isDualAxis, series]);

  // Create custom dollar point style icon for the Cost dataset (compact size)
  const dollarIcon = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const costColor = series && series[1]?.color ? series[1].color : PALETTE[1].replace('0.7', '1');
    return createDollarIcon(costColor, '#ffffff', isDarkMode, 13);
  }, [series, isDarkMode]);

// Plugin for rendering vertical numbers within bar rectangles
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(x, y, width, height, r);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
  }
}

const inBarLabelPlugin = {
  id: 'inBarLabels',
  afterDatasetsDraw(chart: any, _args: any, pluginOptions: any) {
    const config: (InBarLabelsConfig & { isDarkMode?: boolean }) | undefined =
      pluginOptions || chart.options?.plugins?.inBarLabels;
    if (!config || !config.values || config.values.length === 0) {
      return;
    }

    const { ctx, scales: { x, y } } = chart;
    if (!ctx || !x || !y) return;

    const datasetCount = chart.data.datasets?.length || 0;
    if (datasetCount === 0) return;

    const labelsCount = chart.data.labels?.length || 0;
    const currencySymbol = config.currency || '₹';

    for (let i = 0; i < labelsCount; i++) {
      const rawVal = config.values[i];
      if (rawVal == null || rawVal === 0) continue;

      let barX = 0;
      let barWidth = 0;
      let found = false;
      let topY = y.bottom;
      let baseY = y.bottom;

      for (let d = 0; d < datasetCount; d++) {
        const meta = chart.getDatasetMeta(d);
        if (!meta || meta.hidden) continue;
        const el = meta.data[i];
        if (!el) continue;

        if (!found) {
          barX = el.x;
          barWidth = el.width || 0;
          found = true;
        }

        if (typeof el.y === 'number' && !isNaN(el.y)) {
          topY = Math.min(topY, el.y);
        }
        if (typeof el.base === 'number' && !isNaN(el.base)) {
          baseY = Math.max(baseY, el.base);
        }
      }

      if (!found || barWidth < 7) continue;

      const barHeight = baseY - topY;
      if (barHeight < 14) continue;

      const fontSize = Math.min(9.5, Math.max(8, barWidth - 1));
      const fontStr = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      let text = '';
      if (config.type === 'cost') {
        const num = Number(rawVal);
        const full = `${currencySymbol}${num.toLocaleString('en-IN')}`;

        let compact = '';
        if (num >= 10000000) {
          compact = `${currencySymbol}${(num / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
        } else if (num >= 100000) {
          compact = `${currencySymbol}${(num / 100000).toFixed(1).replace(/\.0$/, '')}L`;
        } else if (num >= 1000) {
          compact = `${currencySymbol}${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
        } else {
          compact = `${currencySymbol}${num}`;
        }

        ctx.save();
        ctx.font = fontStr;
        const fullW = ctx.measureText(full).width;
        if (fullW + 12 <= barHeight) {
          text = full;
        } else {
          text = compact;
        }
        ctx.restore();
      } else {
        text = rawVal.toString();
      }

      if (!text) continue;

      ctx.save();
      ctx.font = fontStr;
      const textWidth = ctx.measureText(text).width;
      if (textWidth + 12 > barHeight) {
        ctx.restore();
        continue;
      }

      // Anchor near the bottom baseline of the bar
      const startY = baseY - 5;
      const pillH = Math.min(barWidth - 2, fontSize + 4);
      const pillLen = textWidth + 6;
      const r = Math.min(3, pillH / 2);

      // Rotate -90deg so +X points upwards towards the top of the bar
      ctx.translate(barX, startY);
      ctx.rotate(-Math.PI / 2);

      // Draw subtle modern translucent pill backdrop for contrast without ugly letter outline
      const isDark = config.isDarkMode ?? false;
      ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.50)' : 'rgba(15, 23, 42, 0.42)';
      drawRoundedRect(ctx, 1, -pillH / 2, pillLen, pillH, r);

      // Draw clean, crisp white text aligned to left (starting from the bottom of the bar)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 4, 0);

      ctx.restore();
    }
  },
};

  const datasets = series
    ? series.map((s, i) => {
        const isCostSeries = isDualAxis && (i === 1 || s.name.toLowerCase().includes('cost'));
        const borderColor = s.color || PALETTE[i % PALETTE.length].replace('0.7', '1');
        const backgroundColor = s.color || PALETTE[i % PALETTE.length];

        return {
          label: s.name,
          data: s.data,
          backgroundColor,
          borderColor,
          borderWidth: s.borderWidth ?? (stacked ? 1 : 2),
          fill: s.fill ?? (type === 'line' && !isDualAxis),
          tension: s.tension ?? 0.3,
          spanGaps: false,
          yAxisID: isDualAxis ? (i === 0 ? 'y' : 'y1') : 'y',
          // Use dollar icon for cost line, circle for others
          pointStyle: s.pointStyle ?? (isCostSeries ? dollarIcon : 'circle'),
          pointRadius: s.pointRadius ?? (isCostSeries ? 4.5 : (type === 'line' ? 4 : undefined)),
          pointHoverRadius: s.pointHoverRadius ?? (isCostSeries ? 6.5 : (type === 'line' ? 6 : undefined)),
        };
      })
    : [
        {
          label: title,
          data: data || [],
          backgroundColor: color || 'rgba(59, 130, 246, 0.7)',
          borderColor: color || 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          fill: type === 'line',
          tension: 0.3,
          yAxisID: 'y',
          pointRadius: type === 'line' ? 4 : undefined,
          pointHoverRadius: type === 'line' ? 6 : undefined,
        },
      ];

  const chartData = {
    labels,
    datasets,
  };

  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e5e7eb';
  const textColor = isDarkMode ? '#a1a1aa' : '#52525b';

  const options: any = {
    responsive: true,
    plugins: {
      inBarLabels: inBarLabels ? { ...inBarLabels, currency: inBarLabels.currency || currency, isDarkMode } : undefined,
      legend: {
        display: showLegend ?? (isDualAxis || stacked || (series && series.length > 1)),
        position: legendPosition,
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
          color: textColor,
          font: { size: 12 },
        },
      },
      title: { display: !!title, text: title, font: { size: 18 }, color: isDarkMode ? '#f4f4f5' : '#18181b' },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: any) => {
            const label = ctx.dataset.label || '';
            const val = ctx.parsed.y;
            if (val === null || val === undefined) return ` ${label}: -`;
            const isCost = isDualAxis && (ctx.datasetIndex === 1 || ctx.dataset.yAxisID === 'y1' || label.toLowerCase().includes('cost'));
            if (isCost || yAxisType === 'cost') {
              return ` ${label}: ${currency}${Number(val).toLocaleString()}`;
            }
            return ` ${label}: ${Number(val).toLocaleString()}`;
          },
        },
      },
    },
    indexAxis: type === 'horizontalBar' ? 'y' : 'x',
    scales: {
      x: {
        stacked: stacked,
        grid: { color: gridColor },
        ticks: {
          color: (ctx: any) => {
            const label = labels[ctx.index];
            if (highlightLabel && label === highlightLabel) {
              return isDarkMode ? '#ffffff' : '#111827';
            }
            return textColor;
          },
          font: (ctx: any) => {
            const label = labels[ctx.index];
            if (highlightLabel && label === highlightLabel) {
              return { weight: 'bold' as const, size: 13 };
            }
            return { size: 12 };
          },
        },
      },
      y: {
        stacked: stacked,
        grid: { color: gridColor },
        min: isDualAxis && dualBounds ? dualBounds.axis0.min : (type !== 'horizontalBar' ? 0 : undefined),
        max: isDualAxis && dualBounds ? dualBounds.axis0.max : undefined,
        ticks: {
          color: textColor,
          stepSize: isDualAxis && dualBounds ? dualBounds.axis0.stepSize : (stacked && yAxisType !== 'cost' ? 1 : undefined),
          count: isDualAxis && dualBounds ? dualBounds.axis0.count : undefined,
          callback: (val: any) => {
            if (typeof val === 'number') {
              if (yAxisType === 'cost') {
                return `${currency}${val.toLocaleString()}`;
              }
              return val.toLocaleString();
            }
            return val;
          },
        },
        position: 'left',
      },
    },
    maintainAspectRatio: false,
  };

  if (type === 'horizontalBar') {
    options.scales.x.beginAtZero = true;
  } else {
    options.scales.y.beginAtZero = true;
  }

  if (isDualAxis && dualBounds) {
    options.scales.y1 = {
      type: 'linear',
      display: true,
      position: 'right',
      min: dualBounds.axis1.min,
      max: dualBounds.axis1.max,
      grid: {
        drawOnChartArea: false, // Prevents duplicate lines since 'y' matches the exact same tick heights!
      },
      ticks: {
        color: PALETTE[1].replace('0.7', '1'),
        stepSize: dualBounds.axis1.stepSize,
        count: dualBounds.axis1.count,
        callback: (val: any) => {
          if (typeof val === 'number') {
            return `${currency}${val.toLocaleString()}`;
          }
          return val;
        },
      },
    };
  }

  if (type === 'line') {
    return <div style={{ height }}><Line data={chartData} options={options} /></div>;
  }
  return <div style={{ height }}><Bar data={chartData} options={options} plugins={[inBarLabelPlugin]} /></div>;
} 