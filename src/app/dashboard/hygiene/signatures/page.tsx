import HygieneMobileDriverClient from "@/components/hygiene/HygieneMobileDriverClient";

export default async function HygieneSignaturesPage({
  searchParams,
}: {
  searchParams?: Promise<{ collectionId?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return <HygieneMobileDriverClient view="signatures" collectionId={params.collectionId} />;
}
