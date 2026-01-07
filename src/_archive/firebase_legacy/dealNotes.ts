import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export async function addDealNote(data: {
  dealId: string;
  text: string;
  userId: string;
  userEmail: string;
}) {
  if (!db) return;
  await addDoc(collection(db, 'deal_notes'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getDealNotes(dealId: string) {
  if (!db) return [];
  const q = query(collection(db, 'deal_notes'), where('dealId', '==', dealId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}