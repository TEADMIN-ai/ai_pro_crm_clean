import DealDetailsClient from "./DealDetailsClient";

type PageProps = {
  params: Promise<{
    dealId: string;
  }>;
};

export default async function DealDetailsPage({ params }: PageProps) {
  const { dealId } = await params;

  return <DealDetailsClient dealId={dealId} />;
}