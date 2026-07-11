'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Header() {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(255,255,255,0.92)', color: 'var(--tex-text-strong)', borderBottom: '1px solid var(--tex-border)', backdropFilter: 'blur(12px)' }}>
      <div style={{ fontWeight: 800, color: 'var(--tex-text-strong)' }}>Torque Empire</div>
      <button onClick={() => signOut(auth)} style={{ minHeight: 42, padding: '0 14px', borderRadius: 12, background: 'var(--tex-secondary-action)', color: 'var(--tex-secondary-action-text)', fontWeight: 700, border: '1px solid var(--tex-border-strong)', cursor: 'pointer' }}>Logout</button>
    </header>
  );
}
