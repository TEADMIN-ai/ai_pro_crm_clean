'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Header() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background:
          'linear-gradient(180deg, rgba(20,30,48,0.85), rgba(20,30,48,0.65))',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: '#ffffff',
          textShadow: '0 2px 4px rgba(0,0,0,0.6)',
        }}
      >
        Torque Empire
      </div>

      <button
        onClick={() => signOut(auth)}
        style={{
          padding: '6px 14px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.18)',
          color: '#ffffff',
          fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.25)',
          cursor: 'pointer',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        Logout
      </button>
    </header>
  );
}