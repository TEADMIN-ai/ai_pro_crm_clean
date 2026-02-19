import UploadClient from "./UploadClient";

type PageProps = {
  params: Promise<{
    dealId: string;
  }>;
};

export default async function UploadPage({ params }: PageProps) {
  const { dealId } = await params;
  return <UploadClient dealId={dealId} />;
}
