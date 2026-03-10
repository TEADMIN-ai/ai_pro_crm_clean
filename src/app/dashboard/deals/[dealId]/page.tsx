interface DealPageProps {
  params: {
    dealId: string;
  };
}

export default function DealPage({ params }: DealPageProps) {
  return (
    <div style={{ padding: "40px" }}>
      <h1>Deal Details</h1>
      <p>Deal ID: {params.dealId}</p>
    </div>
  );
}