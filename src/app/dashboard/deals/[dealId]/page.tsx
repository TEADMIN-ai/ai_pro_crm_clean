export default function DealDetailsPage({
  params,
}: {
  params: { dealId: string };
}) {
  return (
    <div style={{ padding: 40 }}>
      <h1>Deal Details</h1>
      <p>Deal ID: {params.dealId}</p>
    </div>
  );
}