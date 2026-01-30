import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import DealCard from "@/components/deals/DealCard";
import type { Deal } from "@/types/deal";

export default async function DealsPage() {
  const deals: Deal[] = await getDealsForUser();

  return (
    <div style={{ padding: 24 }}>
      <h1>Deals</h1>

      {deals.length === 0 && (
        <p style={{ opacity: 0.7 }}>All deals will appear here.</p>
      )}

      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}