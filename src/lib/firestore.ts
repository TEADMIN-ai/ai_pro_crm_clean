import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Deal } from "@/types/deal";

/**
 * Safely fetch all deals from Firestore
 * Build-safe, strict TypeScript compliant
 */
export async function getAllDeals(): Promise<Deal[]> {
  if (!db) {
    console.warn("Firestore DB not initialized");
    return [];
  }

  try {
    const snap = await getDocs(collection(db, "deals"));

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Deal, "id">),
    }));
  } catch (error) {
    console.error("Failed to fetch deals:", error);
    return [];
  }
}

/**
 * Count deals by stage (safe guard)
 */
export function countDealsByStage(
  deals: Deal[],
  stage: Deal["stage"]
): number {
  return deals.filter((d) => d.stage === stage).length;
}