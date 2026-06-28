import VehicleFinanceWorkspace from "@/components/vehicle-finance/VehicleFinanceWorkspace";
import { ReturnButton } from "@/components/navigation/ReturnButton";

type Props = {
  params: Promise<{
    applicationId: string;
  }>;
};

export default async function VehicleFinanceApplicationDetailPage({ params }: Props) {
  const { applicationId } = await params;

  return (
    <>
      <div className="px-4 pt-4 md:px-6 lg:px-8">
        <ReturnButton fallbackHref="/dashboard/vehicle-finance/applications" label="Back to Applications" />
      </div>
      <VehicleFinanceWorkspace initialSection="document-verification" initialApplicationId={applicationId} />
    </>
  );
}
