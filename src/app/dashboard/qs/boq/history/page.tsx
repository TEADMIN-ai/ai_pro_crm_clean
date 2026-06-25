import BoqIntelligenceWorkspace from "@/components/qs/BoqIntelligenceWorkspace";
import { listBoqDocuments, listBoqLineItems, listBoqReviewQueue, listBoqExtractionLogs } from "@/lib/qs/boq";

export default async function QsBoqHistoryPage() {
  const [documents, lineItems, reviewQueue, logs] = await Promise.all([
    listBoqDocuments(100),
    listBoqLineItems(100),
    listBoqReviewQueue(100),
    listBoqExtractionLogs(100),
  ]);

  return <BoqIntelligenceWorkspace view="history" documents={documents} lineItems={lineItems} reviewQueue={reviewQueue} logs={logs} />;
}
