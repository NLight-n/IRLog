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
  data: number[];
  title?: string;
  color?: string;
  height?: number;
}

export default function Chart({ type, labels, data, title, color, height = 320 }: ChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data,
        backgroundColor: color || 'rgba(59, 130, 246, 0.7)',
        borderColor: color || 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  };
  const options: any = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: !!title, text: title, font: { size: 18 } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { grid: { color: '#e5e7eb' }, ticks: { color: '#52525b' } },
      y: { grid: { color: '#e5e7eb' }, ticks: { color: '#52525b' }, beginAtZero: true },
    },
    indexAxis: type === 'horizontalBar' ? 'y' : 'x',
    maintainAspectRatio: false,
  };
  if (type === 'line') {
    return <div style={{ height }}><Line data={chartData} options={options} /></div>;
  }
  return <div style={{ height }}><Bar data={chartData} options={options} /></div>;
} 