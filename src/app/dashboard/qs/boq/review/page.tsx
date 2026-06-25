import BoqIntelligenceWorkspace from "@/components/qs/BoqIntelligenceWorkspace";
import { listBoqDocuments, listBoqLineItems, listBoqReviewQueue, listBoqExtractionLogs } from "@/lib/qs/boq";

export default async function QsBoqReviewPage() {
  const [documents, lineItems, reviewQueue, logs] = await Promise.all([
    listBoqDocuments(50),
    listBoqLineItems(100),
    listBoqReviewQueue(100),
    listBoqExtractionLogs(50),
  ]);

  return <BoqIntelligenceWorkspace view="review" documents={documents} lineItems={lineItems} reviewQueue={reviewQueue} logs={logs} />;
}
