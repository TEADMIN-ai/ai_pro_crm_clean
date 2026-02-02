// src/app/dashboard/deals/page.tsx

import DealsClient from "./DealsClient";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import type { Deal } from "@/types/deal";

export default async function DealsPage() {
  const deals: Deal[] = await getDealsForUser();

  return (
    <div>
      <h1>Deals</h1>
      <DealsClient initialDeals={deals} />
    </div>
  );
}