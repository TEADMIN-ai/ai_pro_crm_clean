import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export async function getDealsByCompany(companyId: string) {
  const q = query(
    collection(db, "deals"),
    where("companyId", "==", companyId)
  );

  const snap = await getDocs(q);

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}