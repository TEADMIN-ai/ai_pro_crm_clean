'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

type RequireRoleProps = {
  role: string;
  children: ReactNode;
};

export default function RequireRole({ role, children }: RequireRoleProps) {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }

  if (!user) {
    return <div style={{ padding: 40 }}>Not authenticated</div>;
  }

  if (userRole !== role) {
    return <div style={{ padding: 40 }}>Access denied</div>;
  }

  return <>{children}</>;
}
