'use client';

import React from 'react';
import EmpireKpiCard from "@/components/ui/EmpireKpiCard";

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
        <EmpireKpiCard key={`${kpi.label}-${index}`} title={kpi.label} value={kpi.value} />
      ))}
    </div>
  );
}

