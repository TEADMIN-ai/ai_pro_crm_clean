export default function DealDetail({ params }: { params: { dealId: string } }) {
  return (
    <main style={{ padding: 40 }}>
      <h1>Deal {params.dealId}</h1>
    </main>
  );
}