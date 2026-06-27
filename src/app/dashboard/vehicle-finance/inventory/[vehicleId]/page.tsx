import RoarVehicleDetailView from "@/components/vehicle-finance/RoarVehicleDetailView";

type Props = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export default async function VehicleInventoryDetailPage({ params }: Props) {
  const { vehicleId } = await params;

  return <RoarVehicleDetailView vehicleId={vehicleId} />;
}
