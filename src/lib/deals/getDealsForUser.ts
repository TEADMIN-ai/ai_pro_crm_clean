import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { Deal } from "@/types/deal";

export async function getDealsForUser(): Promise<Deal[]> {
  try {
    const snapshot = await getDocs(collection(db, "deals"));

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Deal, "id">),
    }));
  } catch (error) {
    console.error("Error loading deals:", error);
    return [];
  }
}