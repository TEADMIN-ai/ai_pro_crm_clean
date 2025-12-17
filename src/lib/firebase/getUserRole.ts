import { db } from './config';
import { doc, getDoc } from 'firebase/firestore';

export async function getUserRole(uid: string): Promise<string> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return 'staff';
  return snap.data().role || 'staff';
}
