"use client";

import type { RevenueKpis } from "@/lib/kpis/revenueKpis";

type Props = {
  kpis: RevenueKpis;
};

function money(n: number) {
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `R ${n}`;
  }
}

export default function RevenueKpiRow({ kpis }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        marginTop: 24,
      }}
    >
      <div>
        <strong>Total Revenue</strong>
        <div>{money(kpis.totalRevenue)}</div>
      </div>

      <div>
        <strong>Won Deals</strong>
        <div>{kpis.wonDeals}</div>
      </div>

      <div>
        <strong>Avg Deal Size</strong>
        <div>{money(kpis.averageDealSize)}</div>
      </div>
    </div>
  );
}