import QsSupplierIntelligenceWorkspace from "@/components/qs/QsSupplierIntelligenceWorkspace";
import { listEstimates } from "@/lib/qs/estimating";
import { listSupplierOffers, listSupplierProfiles } from "@/lib/qs/supplier-intelligence";

export const dynamic = "force-dynamic";

export default async function QsSuppliersPage() {
  const [suppliers, offers, estimates] = await Promise.all([
    listSupplierProfiles(500),
    listSupplierOffers(1000),
    listEstimates(100),
  ]);

  return <QsSupplierIntelligenceWorkspace view="list" suppliers={suppliers} offers={offers} estimates={estimates} />;
}
