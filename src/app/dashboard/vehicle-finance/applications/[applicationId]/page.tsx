import VehicleFinanceWorkspace from "@/components/vehicle-finance/VehicleFinanceWorkspace";

type Props = {
  params: Promise<{
    applicationId: string;
  }>;
};

export default async function VehicleFinanceApplicationDetailPage({ params }: Props) {
  const { applicationId } = await params;

  return <VehicleFinanceWorkspace initialSection="document-verification" initialApplicationId={applicationId} />;
}
