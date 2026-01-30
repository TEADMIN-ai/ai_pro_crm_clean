import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { DealStage } from '@/types/deal';

export async function createDeal(data: {
  title: string;
  clientName: string;
  description?: string;
  value?: number;
  currency?: string;
  stage?: DealStage;
  ownerId: string;
  createdBy: string;
}) {
  if (!db) throw new Error('Firestore not initialized');

  const docRef = await addDoc(collection(db, 'deals'), {
    title: data.title,
    clientName: data.clientName,
    description: data.description ?? '',
    value: data.value ?? null,
    currency: data.currency ?? 'AUD',
    stage: data.stage ?? 'lead',
    ownerId: data.ownerId,
    createdBy: data.createdBy,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}
