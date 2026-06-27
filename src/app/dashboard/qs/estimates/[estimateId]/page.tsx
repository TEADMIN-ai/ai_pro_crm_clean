import { notFound } from "next/navigation";
import QsEstimatingWorkspace from "@/components/qs/QsEstimatingWorkspace";
import { getEstimate, listEstimateHistory } from "@/lib/qs/estimating";

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

  const history = await listEstimateHistory(estimateId);
  return <QsEstimatingWorkspace view="detail" estimate={estimate} history={history} />;
}
