import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type DealNote = {
  id: string;
  dealId: string;
  text: string;
  createdAt?: any;
  createdBy: string;
  companyId: string;
};

export async function addDealNote(input: {
  dealId: string;
  text: string;
  createdBy: string;
  companyId: string;
}) {
  const ref = collection(db, "deals", input.dealId, "notes");
  await addDoc(ref, {
    dealId: input.dealId,
    text: input.text,
    createdBy: input.createdBy,
    companyId: input.companyId,
    createdAt: serverTimestamp(),
  });
}

export async function getDealNotes(dealId: string): Promise<DealNote[]> {
  const ref = collection(db, "deals", dealId, "notes");
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      dealId,
      text: String(data.text ?? ""),
      createdBy: String(data.createdBy ?? ""),
      companyId: String(data.companyId ?? ""),
      createdAt: data.createdAt,
    };
  });
}
