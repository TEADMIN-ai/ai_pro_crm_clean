import React from "react";

type RevenueKpis = {
totalRevenue?: number;
dealsCount?: number;
conversionRate?: number;
};

type Props = {
kpis: RevenueKpis;
};

export default function RevenueKpiRow({ kpis }: Props) {
return (
<div className="p-4 rounded-lg bg-white shadow">
  <h3 className="text-lg font-semibold">Revenue KPI</h3>

  <div className="text-sm text-gray-600 mt-2">
    <p>Total Revenue: {kpis?.totalRevenue ?? 0}</p>
    <p>Deals: {kpis?.dealsCount ?? 0}</p>
    <p>Conversion: {kpis?.conversionRate ?? 0}%</p>
  </div>
</div>
);
}
