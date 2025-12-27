'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { getUserRole } from '@/lib/firebase/getUserRole';

export default function RequireRole({
  allow,
  children,
  fallback = null,
}: {
  allow: Array<'admin' | 'user'>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      const user = auth?.currentUser;
      if (!user) return setOk(false);
      const role = await getUserRole(user.uid);
      setOk(allow.includes(role as any));
    };
    run();
  }, [allow]);

  if (ok === null) return null;
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
}
