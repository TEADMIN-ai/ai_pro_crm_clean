import { db } from './config';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';

export async function notifyUser(data: {
  userId: string;
  title: string;
  message: string;
  link: string;
}) {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function getUserNotifications(userId: string) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
