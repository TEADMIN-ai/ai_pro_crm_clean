"use client";

import type { RevenueKpis } from "@/lib/kpis/revenueKpis";

function moneyZAR(value: number) {
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

type Props = {
  kpis: RevenueKpis;
};

export default function RevenueKpiRow({ kpis }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 20,
        marginBottom: 28,
      }}
    >
      <div>
        <strong>Total Revenue</strong>
        <div>{moneyZAR(kpis.totalRevenue)}</div>
      </div>

      <div>
        <strong>Won Deals</strong>
        <div>{kpis.wonDeals}</div>
      </div>

      <div>
        <strong>Avg Deal Size</strong>
        <div>{moneyZAR(kpis.avgDealSize)}</div>
      </div>
    </div>
  );
}

