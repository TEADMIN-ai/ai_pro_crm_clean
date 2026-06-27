import { notFound } from "next/navigation";
import QsEstimatingWorkspace from "@/components/qs/QsEstimatingWorkspace";
import { getEstimate, listEstimateHistory } from "@/lib/qs/estimating";
import { listCommercialScenariosForEstimate, listRecommendationsForEstimate } from "@/lib/qs/supplier-intelligence";

export const dynamic = "force-dynamic";

export default async function QsEstimateDetailPage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const { estimateId } = await params;
  const estimate = await getEstimate(estimateId);

  if (!estimate) {
    notFound();
  }

  const [history, supplierRecommendations, commercialScenarios] = await Promise.all([
    listEstimateHistory(estimateId),
    listRecommendationsForEstimate(estimateId),
    listCommercialScenariosForEstimate(estimateId),
  ]);

  return (
    <QsEstimatingWorkspace
      view="detail"
      estimate={estimate}
      history={history}
      supplierRecommendations={supplierRecommendations}
      commercialScenarios={commercialScenarios}
    />
  );
}
