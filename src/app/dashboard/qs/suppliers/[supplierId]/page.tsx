import { notFound } from "next/navigation";
import QsSupplierIntelligenceWorkspace from "@/components/qs/QsSupplierIntelligenceWorkspace";
import { getSupplierProfile, listSupplierOffers } from "@/lib/qs/supplier-intelligence";

export const dynamic = "force-dynamic";

export default async function QsSupplierDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  const [supplier, offers] = await Promise.all([
    getSupplierProfile(supplierId),
    listSupplierOffers(1000),
  ]);

  if (!supplier) {
    notFound();
  }

  return <QsSupplierIntelligenceWorkspace view="detail" supplier={supplier} offers={offers.filter((offer) => offer.supplierId === supplier.supplierId)} />;
}
