import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export async function getDeals() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'deals'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createDeal(data: {
  title: string;
  value: number;
  status: string;
}) {
  if (!db) return;
  await addDoc(collection(db, 'deals'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}