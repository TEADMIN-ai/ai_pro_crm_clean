import { useEffect, useState } from "react";
import { computeRevenueIntelligence } from "@/lib/kpis/revenueIntelligence";
import { Deal } from "@/types/deal";

// Define RevenueIntelligence type locally if not exported from the module
type RevenueIntelligence = {
  total: number;
  weighted: number;
};

type Props = {
  deals: Deal[];
};

export default function RevenueIntelligencePanel({ deals }: Props) {
  const [stats, setStats] = useState<RevenueIntelligence | null>(null);

  useEffect(() => {
    const data: RevenueIntelligence = computeRevenueIntelligence(deals);
    setStats(data);
  }, [deals]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h3>Revenue Intelligence</h3>
      <p>Deals: {stats.total}</p>
      <p>Value: {moneyZAR(stats.weighted)}</p>
    </div>
  );
}

// Ensure moneyZAR function is defined if needed
function moneyZAR(value: number): string {
  return `R ${value.toLocaleString()}`;
}