import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

/**
 * Save contractor data
 * SAFE for build: does NOT throw if db is null
 */
export async function saveContractorToFirestore(
  contractorId: string,
  data: any
) {
  // 🔒 During build / SSR, db is null → do nothing
  if (!db) {
    return { skipped: true };
  }

  const ref = doc(db, "contractors", contractorId);

  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { contractorId };
}