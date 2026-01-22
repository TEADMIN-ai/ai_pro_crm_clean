'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#fff',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      Logout
    </button>
  );
}