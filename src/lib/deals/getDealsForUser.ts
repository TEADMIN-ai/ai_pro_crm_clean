import { Deal } from "@/types/deal";

/**
 * TEMP SAFE STUB
 * Replace with Firestore later (F7)
 */
export async function getDealsForUser(): Promise<Deal[]> {
  return [
    {
      id: "deal-1",
      title: "Sample Deal 1",
      stage: "won",
      value: 10000,
      currency: "ZAR",
      isTenderLocked: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      documents: [],
    },
    {
      id: "deal-2",
      title: "Sample Deal 2",
      stage: "tender",
      value: 20000,
      currency: "ZAR",
      isTenderLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      documents: [],
    },
    {
      id: "deal-3",
      title: "Sample Deal 3",
      stage: "submitted",
      value: 15000,
      currency: "ZAR",
      isTenderLocked: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      documents: [],
    },
  ];
}