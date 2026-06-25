import { SupplierProfilePlaceholder } from "@/components/qs/MaterialIntelligenceCentre";

export default async function QsMaterialSupplierProfilePage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;

  return <SupplierProfilePlaceholder supplierId={supplierId} />;
}
