import React from 'react';
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

interface ChartProps {
  type: 'bar' | 'line' | 'horizontalBar';
  labels: string[];
  data?: number[]; // Make data optional
  series?: { name: string; data: number[]; color?: string }[]; // Add series prop
  title?: string;
  color?: string;
  height?: number;
}

const PALETTE = [
  'rgba(59, 130, 246, 0.7)',
  'rgba(239, 68, 68, 0.7)',
  'rgba(34, 197, 94, 0.7)',
  'rgba(249, 115, 22, 0.7)',
  'rgba(168, 85, 247, 0.7)',
];

export default function Chart({ type, labels, data, series, title, color, height = 320 }: ChartProps) {
  const isDualAxis = series && series.length > 1;

  const datasets = series
    ? series.map((s, i) => ({
        label: s.name,
        data: s.data,
        backgroundColor: s.color || PALETTE[i % PALETTE.length],
        borderColor: s.color || PALETTE[i % PALETTE.length].replace('0.7', '1'),
        borderWidth: 2,
        fill: type === 'line', // Only fill for line charts
        tension: 0.3,
        yAxisID: i === 0 ? 'y' : 'y1',
      }))
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
        },
      ];

  const chartData = {
    labels,
    datasets,
  };

  const options: any = {
    responsive: true,
    plugins: {
      legend: { display: isDualAxis },
      title: { display: !!title, text: title, font: { size: 18 } },
      tooltip: { mode: 'index', intersect: false },
    },
    indexAxis: type === 'horizontalBar' ? 'y' : 'x',
    scales: {
      x: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#52525b' },
      },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#52525b' },
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

  if (isDualAxis) {
    options.scales.y1 = {
      type: 'linear',
      display: true,
      position: 'right',
      grid: {
        drawOnChartArea: false,
      },
      ticks: { color: PALETTE[1].replace('0.7', '1') },
      beginAtZero: true,
    };
  }

  if (type === 'line') {
    return <div style={{ height }}><Line data={chartData} options={options} /></div>;
  }
  return <div style={{ height }}><Bar data={chartData} options={options} /></div>;
} 