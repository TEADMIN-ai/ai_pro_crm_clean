import { db } from './config';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

export async function addDealNote(data: {
  dealId: string;
  note: string;
  userId: string;
  userEmail: string;
}) {
  await addDoc(collection(db, 'deal_notes'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getDealNotes(dealId: string) {
  const q = query(
    collection(db, 'deal_notes'),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'asc')
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

