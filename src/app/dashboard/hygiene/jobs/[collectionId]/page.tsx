import HygieneMobileDriverClient from "@/components/hygiene/HygieneMobileDriverClient";

export default async function HygieneJobDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  return <HygieneMobileDriverClient view="job-detail" collectionId={collectionId} />;
}
