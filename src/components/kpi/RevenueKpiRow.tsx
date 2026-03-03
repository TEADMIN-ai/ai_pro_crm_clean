"use client";

import type { RevenueKpis } from "@/lib/kpis/revenueKpis";
import EmpireKpiCard from "@/components/ui/EmpireKpiCard";

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
        <EmpireKpiCard title="Total Revenue" value={moneyZAR(kpis.totalRevenue)} />
      </div>

      <div>
        <EmpireKpiCard title="Won Deals" value={kpis.wonDeals} />
      </div>

      <div>
        <EmpireKpiCard title="Avg Deal Size" value={moneyZAR(kpis.avgDealSize)} />
      </div>
    </div>
  );
}

