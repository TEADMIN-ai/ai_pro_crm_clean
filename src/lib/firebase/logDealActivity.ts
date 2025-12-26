import { db } from './config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function logDealActivity(data: {
  dealId: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  userId: string;
  userEmail: string;
}) {
  await addDoc(collection(db, 'deal_activity'), {
    ...data,
    timestamp: serverTimestamp(),
  });
}

