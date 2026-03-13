import DealRecordClient from "./DealRecordClient";

type DealPageProps = {
  params: Promise<{
    dealId: string;
  }>;
};

export default async function DealPage({ params }: DealPageProps) {
  const { dealId } = await params;

  return <DealRecordClient dealId={decodeURIComponent(dealId)} />;
}
