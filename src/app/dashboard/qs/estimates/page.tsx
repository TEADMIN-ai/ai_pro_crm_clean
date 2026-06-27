import QsEstimatingWorkspace from "@/components/qs/QsEstimatingWorkspace";
import { listBoqDocuments } from "@/lib/qs/boq";
import { listEstimates } from "@/lib/qs/estimating";

export const dynamic = "force-dynamic";

export default async function QsEstimatesPage() {
  const [estimates, boqDocuments] = await Promise.all([
    listEstimates(100),
    listBoqDocuments(100),
  ]);

  return <QsEstimatingWorkspace view="list" estimates={estimates} boqDocuments={boqDocuments} />;
}
