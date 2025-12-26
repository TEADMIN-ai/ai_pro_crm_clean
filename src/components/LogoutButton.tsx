'use client';

import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button onClick={async () => {
      if (!auth) return;
        await signOut(auth);
      router.push('/login');
    }}>
      Logout
    </button>
  );
}


