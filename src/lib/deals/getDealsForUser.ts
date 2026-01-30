import type { Deal } from "@/types/deal";

/**
 * SAFE STUB — server-side data loader
 * This will later be replaced with Firestore logic
 */
export async function getDealsForUser(): Promise<Deal[]> {
  return [
    {
      id: "deal-1",
      title: "Removal of Hazardous Waste 32x month Contract",
      stage: "won",
      value: 250000,
      currency: "ZAR",
    },
    {
      id: "deal-2",
      title: "Purchase Order",
      stage: "won",
      value: 1165646,
      currency: "ZAR",
    },
    {
      id: "deal-3",
      title: "Vehicle Finance Application",
      stage: "lead",
      value: 0,
      currency: "ZAR",
    },
  ];
}