import { getUserRole } from '@/lib/firebase/getUserRole';

export async function requireRole(
  uid: string | null,
  allowed: Array<'admin' | 'user'>
): Promise<boolean> {
  if (!uid) return false;
  const role = await getUserRole(uid);
  return allowed.includes(role as any);
}
