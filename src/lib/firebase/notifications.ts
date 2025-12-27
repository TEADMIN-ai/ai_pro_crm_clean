import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt?: any;
};

export async function notifyUser(data: {
  userId: string;
  title: string;
  message: string;
  link?: string;
}) {
  if (!db) return;

  await addDoc(collection(db, 'notifications'), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  if (!db) return [];

  const q = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);

  return snap.docs
    .map(d => ({
      id: d.id,
      ...(d.data() as Omit<Notification, 'id'>),
    }))
    .filter(n => n.userId === userId);
}

export async function markNotificationRead(id: string) {
  if (!db) return;
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
