import React from 'react';

export default function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div style={{
      width: '100%',
      height: 320,
      background: 'repeating-linear-gradient(135deg, #e5e7eb, #e5e7eb 16px, #f3f4f6 16px, #f3f4f6 32px)',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#888',
      fontSize: 22,
      fontWeight: 500,
      border: '2px dashed #cbd5e1',
      marginBottom: 8
    }}>
      {title} (Chart Placeholder)
    </div>
  );
} 