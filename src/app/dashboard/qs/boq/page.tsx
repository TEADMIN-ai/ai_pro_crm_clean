import BoqIntelligenceWorkspace from "@/components/qs/BoqIntelligenceWorkspace";
import { listBoqDocuments, listBoqLineItems, listBoqReviewQueue, listBoqExtractionLogs } from "@/lib/qs/boq";

export const dynamic = "force-dynamic";

export default async function QsBoqPage() {
  const [documents, lineItems, reviewQueue, logs] = await Promise.all([
    listBoqDocuments(50),
    listBoqLineItems(100),
    listBoqReviewQueue(100),
    listBoqExtractionLogs(50),
  ]);

  return <BoqIntelligenceWorkspace view="overview" documents={documents} lineItems={lineItems} reviewQueue={reviewQueue} logs={logs} />;
}
