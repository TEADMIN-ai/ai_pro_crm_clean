import QsCommercialIntelligenceDashboard from "@/components/qs/QsCommercialIntelligenceDashboard";
import { buildCommercialDashboardSummary } from "@/lib/qs/commercial-intelligence";

export const dynamic = "force-dynamic";

export default async function QsCommercialIntelligencePage() {
  const summary = await buildCommercialDashboardSummary();
  return <QsCommercialIntelligenceDashboard summary={summary} />;
}
