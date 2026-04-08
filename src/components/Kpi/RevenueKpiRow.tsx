import type { RevenueKpis } from "@/lib/kpis/revenueKpis";

type RevenueKpiRowProps = {
  kpis: RevenueKpis;
};

export default function RevenueKpiRow({ kpis }: RevenueKpiRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-sm font-semibold text-gray-600">Total Revenue</h3>
        <p className="text-2xl font-semibold text-gray-900">
          ZAR {kpis.totalRevenue.toLocaleString("en-ZA")}
        </p>
      </div>
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-sm font-semibold text-gray-600">Won Deals</h3>
        <p className="text-2xl font-semibold text-gray-900">{kpis.wonDeals}</p>
      </div>
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-sm font-semibold text-gray-600">Average Deal Size</h3>
        <p className="text-2xl font-semibold text-gray-900">
          ZAR {kpis.avgDealSize.toLocaleString("en-ZA")}
        </p>
      </div>
    </div>
  );
}
