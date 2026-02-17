'use client';

import React from 'react';

interface KpiItem {
  label: string;
  value: number | string;
}

interface Props {
  items?: KpiItem[];
}

export default function KpiRow({ items = [] }: Props) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 20,
        marginTop: 32,
      }}
    >
      {items.map((kpi, index) => (
        <div
          key={index}
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>{kpi.label}</div>
          <div style={{ fontSize: 32, fontWeight: 600 }}>{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}

